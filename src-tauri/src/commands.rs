use std::{
    fs::{self, File, remove_file},
    io::copy,
    path::Path,
};

use directories::UserDirs;
use tauri::{command, AppHandle, Emitter};
use zip::ZipArchive;
use uuid::Uuid;
use tokio::task;

/// Safe unzip helper
#[command]
pub fn unzip_file(zip_path: String, target_dir: String) -> Result<(), String> {
    let zip_file = File::open(&zip_path)
        .map_err(|e| format!("Failed to open zip file {}: {}", zip_path, e))?;
    let mut archive = ZipArchive::new(zip_file)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create target directory {}: {}", target_dir, e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Error reading zip entry: {}", e))?;
        let outpath = Path::new(&target_dir).join(file.mangled_name());

        if file.name().ends_with('/') || file.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory {:?}: {}", outpath, e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent directory {:?}: {}", parent, e))?;
                }
            }
            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed to create file {:?}: {}", outpath, e))?;
            copy(&mut file, &mut outfile)
                .map_err(|e| format!("Error copying file to {:?}: {}", outpath, e))?;
        }
    }

    remove_file(&zip_path)
        .map_err(|e| format!("Failed to remove zip file {}: {}", zip_path, e))?;

    Ok(())
}

/// Save raw bytes to file
#[command]
pub fn save_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    let file_path = Path::new(&path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory structure for {}: {}", path, e))?;
    }
    fs::write(&file_path, &contents)
        .map_err(|e| format!("Failed to write file {}: {}", path, e))?;
    Ok(())
}

/// Async-safe download + unzip + event emit after completion
#[tauri::command(async)]
pub async fn download_and_install(
    url: String,
    destination: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let user_dirs = UserDirs::new().ok_or("Could not determine user directories")?;
    let documents = user_dirs.document_dir().ok_or("Could not determine the documents directory")?;
    let final_destination = documents.join(Path::new(&destination));

    println!("Absolute destination path: {:?}", final_destination);

    fs::create_dir_all(&final_destination)
        .map_err(|e| format!("Failed to create destination directory {:?}: {}", final_destination, e))?;

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download file from {}: {}", url, e))?;
    if !response.status().is_success() {
        return Err(format!("Download failed with HTTP status {}", response.status()));
    }

    let headers = response.headers().clone();
    let bytes = response.bytes()
        .await
        .map_err(|e| format!("Failed to read response bytes: {}", e))?;

    let is_zip = bytes.len() >= 4 && bytes.starts_with(b"PK\x03\x04");

    if is_zip {
        let tmp_dir = std::env::temp_dir();
        let unique_filename = format!("downloaded_{}.zip", Uuid::new_v4());
        let tmp_file_path = tmp_dir.join(unique_filename);

        fs::write(&tmp_file_path, &bytes)
            .map_err(|e| format!("Error writing temporary zip file: {}", e))?;

        let zip_path = tmp_file_path.to_string_lossy().to_string();
        let target_path = final_destination.to_string_lossy().to_string();
        let app_handle_clone = app_handle.clone();

        task::spawn_blocking(move || {
            let result = unzip_file(zip_path, target_path);
            if result.is_ok() {
                let _ = app_handle_clone.emit("maps-changed", "changed");
            }
            result
        })
        .await
        .unwrap_or_else(|e| Err(format!("Unzip task panicked: {}", e)))
    } else {
        let filename_from_header = headers.get("content-disposition")
            .and_then(|value| value.to_str().ok())
            .and_then(|content| {
                if let Some(idx) = content.find("filename=") {
                    let start = idx + "filename=".len();
                    Some(content[start..].trim_matches(|c| c == '"' || c == '\'').to_string())
                } else {
                    None
                }
            });

        let filename = filename_from_header.unwrap_or_else(|| {
            url.split('/').last().unwrap_or("downloaded_file").to_string()
        });

        let file_save_path = final_destination.join(filename);
        println!("Saving file to: {:?}", file_save_path);

        let result = save_file(
            file_save_path.to_string_lossy().to_string(),
            bytes.to_vec()
        );

        if result.is_ok() {
            let _ = app_handle.emit("maps-changed", "changed");
        }

        result
    }
}

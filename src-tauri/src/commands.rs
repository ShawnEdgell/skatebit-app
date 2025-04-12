use std::{
    collections::HashSet,
    ffi::OsStr,
    fs::{self, remove_file, File},
    io::copy,
    path::Path,
};

use directories::UserDirs;
use tauri::Emitter;
use tauri::{command, AppHandle};
use tokio::task;
use uuid::Uuid;
use zip::ZipArchive;

/// Extracts a ZIP file into a clean subfolder inside the maps folder
#[command]
pub fn unzip_file(zip_path: String, maps_folder: String) -> Result<(), String> {
    let zip_file = File::open(&zip_path)
        .map_err(|e| format!("Failed to open zip file {}: {}", zip_path, e))?;
    let mut archive =
        ZipArchive::new(zip_file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let mut top_levels = HashSet::new();
    let mut fallback_name: Option<String> = None;
    let mut all_start_with_same_folder = true;
    let mut common_root: Option<String> = None;

    for i in 0..archive.len() {
        let file = archive.by_index(i).map_err(|e| e.to_string())?;
        let path = file.mangled_name();

        if let Some(first) = path.components().next() {
            let part = first.as_os_str().to_string_lossy().to_string();
            top_levels.insert(part.clone());
            if common_root.is_none() {
                common_root = Some(part);
            } else if common_root.as_ref() != Some(&part) {
                all_start_with_same_folder = false;
            }
        }

        if fallback_name.is_none() {
            if let Some(stem) = path.file_stem().and_then(OsStr::to_str) {
                fallback_name = Some(stem.to_string());
            }
        }
    }

    let folder_name = if all_start_with_same_folder && top_levels.len() == 1 {
        common_root.unwrap()
    } else {
        fallback_name.unwrap_or_else(|| format!("map_{}", Uuid::new_v4()))
    };

    let target_dir = Path::new(&maps_folder).join(&folder_name);
    fs::create_dir_all(&target_dir).map_err(|e| {
        format!(
            "Failed to create map folder {}: {}",
            target_dir.display(),
            e
        )
    })?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let original_path = file.mangled_name();

        let stripped_path = if all_start_with_same_folder && top_levels.len() == 1 {
            let mut comps = original_path.components();
            comps.next();
            comps.as_path().to_path_buf()
        } else {
            original_path.clone()
        };

        let outpath = target_dir.join(stripped_path);

        if file.name().ends_with('/') || file.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory {:?}: {}", outpath, e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir {:?}: {}", parent, e))?;
            }
            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed to create file {:?}: {}", outpath, e))?;
            copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to copy file to {:?}: {}", outpath, e))?;
            outfile
                .sync_all()
                .map_err(|e| format!("Failed to sync file {:?}: {}", outpath, e))?;
        }
    }

    remove_file(&zip_path).map_err(|e| format!("Failed to remove zip file: {}", e))?;

    Ok(())
}

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

#[tauri::command(async)]
pub async fn download_and_install(
    url: String,
    destination: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let user_dirs = UserDirs::new().ok_or("Could not determine user directories".to_string())?;
    let documents = user_dirs
        .document_dir()
        .ok_or("Could not determine the documents directory".to_string())?;
    let maps_folder = documents.join(&destination);
    fs::create_dir_all(&maps_folder).map_err(|e| {
        format!(
            "Failed to create destination directory {:?}: {}",
            maps_folder, e
        )
    })?;

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download from {}: {}", url, e))?;
    if !response.status().is_success() {
        return Err(format!(
            "Download failed with HTTP status {}",
            response.status()
        ));
    }

    let headers = response.headers().clone();
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read bytes: {}", e))?;

    let is_zip = bytes.len() >= 4 && bytes.starts_with(b"PK\x03\x04");

    if is_zip {
        let tmp_file_path = std::env::temp_dir().join(format!("downloaded_{}.zip", Uuid::new_v4()));
        fs::write(&tmp_file_path, &bytes)
            .map_err(|e| format!("Error writing temp zip file: {}", e))?;

        let zip_path = tmp_file_path.to_string_lossy().to_string();
        let maps_folder_str = maps_folder.to_string_lossy().to_string();
        let app_handle_clone = app_handle.clone();

        task::spawn_blocking(move || {
            let result = unzip_file(zip_path, maps_folder_str);
            if result.is_ok() {
                let _ = app_handle_clone.emit("maps-changed", "changed");
            }
            result
        })
        .await
        .unwrap_or_else(|e| Err(format!("Unzip task panicked: {}", e)))
    } else {
        let filename = headers
            .get("content-disposition")
            .and_then(|v| v.to_str().ok())
            .and_then(|content| content.split("filename=").nth(1))
            .map(|s| s.trim_matches('"').to_string())
            .unwrap_or_else(|| {
                url.split('/')
                    .last()
                    .unwrap_or("downloaded_file")
                    .to_string()
            });

        let file_path = maps_folder.join(filename);
        let result = save_file(file_path.to_string_lossy().to_string(), bytes.to_vec());

        if result.is_ok() {
            let _ = app_handle.emit("maps-changed", "changed");
        }

        result
    }
}

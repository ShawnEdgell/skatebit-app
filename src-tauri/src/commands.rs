use std::fs::{self, File, remove_file};
use std::io::copy;
use std::path::Path;
use std::time::Duration;
use directories::UserDirs;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config, Event};
use tauri::{command, AppHandle, Emitter};
use zip::ZipArchive;

#[allow(dead_code)]
#[command]
pub fn start_maps_watcher(app_handle: AppHandle) {
  std::thread::spawn(move || {
    let user_dirs = UserDirs::new().expect("Unable to get user directories");
    let documents = user_dirs.document_dir().expect("Unable to get documents directory");
    let maps_folder = documents.join("SkaterXL/Maps");

    let mut watcher = RecommendedWatcher::new(
      move |res: Result<Event, notify::Error>| {
        match res {
          Ok(_event) => {
            // Instead of trying to serialize the event (which fails), we emit a simple string.
            if let Err(e) = app_handle.emit("maps-changed", "changed") {
              eprintln!("Failed to emit maps-changed event: {}", e);
            }
          },
          Err(e) => eprintln!("File watch error: {:?}", e),
        }
      },
      Config::default().with_poll_interval(Duration::from_secs(2)),
    )
    .expect("Failed to create file system watcher");

    watcher.watch(maps_folder.as_path(), RecursiveMode::Recursive)
      .expect("Failed to watch maps folder");

    loop {
      std::thread::sleep(Duration::from_secs(60));
    }
  });
}

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
pub async fn download_and_install(url: String, destination: String) -> Result<(), String> {
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
    let tmp_file_path = tmp_dir.join("downloaded.zip");
    fs::write(&tmp_file_path, &bytes)
      .map_err(|e| format!("Error writing temporary zip file: {}", e))?;
    unzip_file(
      tmp_file_path.to_string_lossy().to_string(),
      final_destination.to_string_lossy().to_string()
    )
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
    save_file(
      file_save_path.to_string_lossy().to_string(),
      bytes.to_vec()
    )
  }
}

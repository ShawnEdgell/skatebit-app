// src-tauri/commands.rs

use directories::UserDirs;
use once_cell::sync::Lazy;
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    ffi::OsStr,
    fs::{self, remove_file, File},
    io::copy, 
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{command, AppHandle, Emitter};
use tokio::task;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::ZipArchive;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ListingStatus {
    ExistsAndPopulated,
    ExistsAndEmpty,
    DoesNotExist,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListingResult {
    status: ListingStatus,
    entries: Vec<FsEntry>,
    path: PathBuf,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    name: Option<String>,
    path: PathBuf,
    is_directory: bool,
    size: Option<u64>,
    modified: Option<u64>,
    thumbnail_path: Option<PathBuf>,
    thumbnail_mime_type: Option<String>,
}

static THUMBNAIL_EXTS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    ["png", "jpg", "jpeg", "gif", "webp", "bmp"]
        .iter()
        .cloned()
        .collect()
});

static EXCLUDED_FILE_EXTS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        // Image formats
        "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico",
        // Executables and system files
        "dll", "exe", "bat", "msi",
        // Configuration and metadata files
        "json", "ini", "bak", "cfg", "tmp", "log", "txt", "rtf", "xml",
        // Archives and compressed files
        "zip", "rar", "7z", "tar", "gz",
        // Database and lock files
        "db", "sqlite", "lock",
        // Document files (if not relevant)
        "md", "doc", "docx",
        // Media files (if not meant to be maps)
        "mp3", "mp4", "avi", "mov", "mkv", "flv",
        // Shortcut files
        "lnk",
        // Debug or symbol files
        "pdb",
    ]
    .iter()
    .cloned()
    .collect()
});

fn calculate_directory_size(path: &Path) -> u64 {
    WalkDir::new(path)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

fn system_time_to_millis(time: Option<SystemTime>) -> Option<u64> {
    time.and_then(|t| {
        t.duration_since(UNIX_EPOCH)
            .ok()
            .map(|d| d.as_millis() as u64)
    })
}

fn resolve_document_path(relative_path: &str) -> Result<PathBuf, String> {
    let user_dirs = UserDirs::new().ok_or_else(|| "Could not determine user directories".to_string())?;
    let documents = user_dirs
        .document_dir()
        .ok_or_else(|| "Could not determine documents directory".to_string())?;
    Ok(documents.join(relative_path))
}

fn get_mime_type_from_extension(extension: &str) -> Option<String> {
    match extension.to_lowercase().as_str() {
        "png" => Some("image/png".to_string()),
        "jpg" | "jpeg" => Some("image/jpeg".to_string()),
        "gif" => Some("image/gif".to_string()),
        "webp" => Some("image/webp".to_string()),
        "bmp" => Some("image/bmp".to_string()),
        _ => None,
    }
}

#[command]
pub fn unzip_file(zip_path: String, maps_folder: String) -> Result<(), String> {
    let maps_folder_path = PathBuf::from(&maps_folder);
    if !maps_folder_path.is_dir() {
        return Err(format!("Target directory does not exist or is not a directory: {}", maps_folder));
    }

    let zip_file = File::open(&zip_path).map_err(|e| format!("Failed open zip {}: {}", zip_path, e))?;
    let mut archive = ZipArchive::new(zip_file).map_err(|e| format!("Failed read zip: {}", e))?;
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

    let target_dir = maps_folder_path.join(&folder_name);
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed create map folder {}: {}", target_dir.display(), e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let original_path = file.mangled_name();

        let stripped_path = if all_start_with_same_folder && top_levels.len() == 1 {
            original_path.components().skip(1).collect::<PathBuf>()
        } else {
            original_path
        };

        if stripped_path.as_os_str().is_empty() { continue; }

        let outpath = target_dir.join(stripped_path);

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed create directory {:?}: {}", outpath, e))?;
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                   fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed create parent dir {:?}: {}", parent, e))?;
                }
            }
            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed create file {:?}: {}", outpath, e))?;
            copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed copy file to {:?}: {}", outpath, e))?;
        }
    }

    remove_file(&zip_path).map_err(|e| format!("Failed remove zip file {}: {}", zip_path, e))?;
    Ok(())
}

#[command]
pub fn save_file(absolute_path: String, contents: Vec<u8>) -> Result<(), String> {
    let file_path = PathBuf::from(absolute_path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed create dir structure {}: {}", file_path.display(), e))?;
    }
    fs::write(&file_path, &contents)
        .map_err(|e| format!("Failed write file {}: {}", file_path.display(), e))?;
    Ok(())
}

#[command(async)]
pub async fn download_and_install(
    url: String,
    destination_subfolder: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let full_destination_path = resolve_document_path(&destination_subfolder)?;
    fs::create_dir_all(&full_destination_path).map_err(|e| {
        format!(
            "Failed create destination dir {:?}: {}",
            full_destination_path.display(), e
        )
    })?;

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed download {}: {}", url, e))?;
    if !response.status().is_success() {
        return Err(format!("Download failed status {}", response.status()));
    }
    let headers = response.headers().clone();
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed read bytes: {}", e))?;

    let is_zip = bytes.len() >= 4 && bytes.starts_with(b"PK\x03\x04");
    if is_zip {
        let tmp_file_path = std::env::temp_dir().join(format!("downloaded_{}.zip", Uuid::new_v4()));
        fs::write(&tmp_file_path, &bytes).map_err(|e| format!("Error writing temp zip: {}", e))?;
        let zip_path_str = tmp_file_path.to_string_lossy().to_string();
        let dest_path_str = full_destination_path.to_string_lossy().to_string();
        let app_handle_clone = app_handle.clone();

        task::spawn_blocking(move || {
            let result = unzip_file(zip_path_str, dest_path_str);
            if result.is_ok() {
                let _ = app_handle_clone.emit("maps-changed", "changed");
            }
            result
        })
        .await
        .map_err(|e| format!("Unzip task panicked: {}", e))?
    } else {
        let filename = headers
            .get("content-disposition")
            .and_then(|v| v.to_str().ok())
            .and_then(|c| c.split("filename=").nth(1))
            .map(|s| s.trim_matches('"').to_string())
            .unwrap_or_else(|| {
                url.split('/')
                    .last()
                    .unwrap_or("downloaded_file")
                    .to_string()
            });
        let target_file_path = full_destination_path.join(filename);
        let result = save_file(target_file_path.to_string_lossy().to_string(), bytes.to_vec());
        if result.is_ok() {
             let _ = app_handle.emit("maps-changed", "changed");
        }
        result
    }
}

#[command]
pub fn list_local_maps(relative_maps_path: String) -> Result<DirectoryListingResult, String> {
    let maps_folder_path = resolve_document_path(&relative_maps_path)?;
    println!("[RUST] list_local_maps: Checking {}", maps_folder_path.display());

    if !maps_folder_path.exists() {
         return Ok(DirectoryListingResult {
            status: ListingStatus::DoesNotExist,
            entries: Vec::new(),
            path: maps_folder_path,
        });
    }
     if !maps_folder_path.is_dir() {
        return Err(format!("Path is not a directory: {}", maps_folder_path.display()));
    }

    let mut map_entries = Vec::new();
    let mut thumbnail_map: HashMap<String, (PathBuf, String)> = HashMap::new();
    let mut is_empty = true;

    let mut dir_reader_peek = match fs::read_dir(&maps_folder_path) {
        Ok(reader) => reader.peekable(),
        Err(e) => return Err(format!("Failed read dir for thumbnails {}: {}", maps_folder_path.display(), e)),
    };

    if dir_reader_peek.peek().is_some() {
        is_empty = false;
        let dir_reader_thumbs = fs::read_dir(&maps_folder_path)
             .map_err(|e| format!("Failed re-read dir for thumbnails {}: {}", maps_folder_path.display(), e))?;
        for entry_result in dir_reader_thumbs {
            if let Ok(entry) = entry_result {
                 let path = entry.path();
                 let file_name_os = entry.file_name();
                 let file_name_str = file_name_os.to_string_lossy();
                 if path.is_dir() {
                     let dir_name_lower = file_name_str.to_lowercase();
                     let mut found_thumbnail = false;
                     for ext in THUMBNAIL_EXTS.iter() {
                         let candidate_path = path.join(format!("{}.{}", file_name_str, ext));
                         if candidate_path.is_file() {
                             if let Some(mime) = get_mime_type_from_extension(ext) {
                                 thumbnail_map.insert(dir_name_lower.clone(), (candidate_path, mime));
                                 found_thumbnail = true;
                                 break;
                             }
                         }
                     }
                     if !found_thumbnail {
                          if let Ok(sub_entries) = fs::read_dir(&path) {
                             for sub_res in sub_entries {
                                 if let Ok(sub_entry) = sub_res {
                                     let sub_path = sub_entry.path();
                                     if sub_path.is_file() {
                                         if let Some(ext) = sub_path.extension().and_then(OsStr::to_str) {
                                             if THUMBNAIL_EXTS.contains(ext.to_lowercase().as_str()) {
                                                 if let Some(mime) = get_mime_type_from_extension(ext) {
                                                     thumbnail_map.insert(dir_name_lower.clone(), (sub_path, mime));
                                                     break;
                                                 }
                                             }
                                         }
                                     }
                                 }
                             }
                         }
                     }
                 } else if path.is_file() {
                     if let Some(ext) = path.extension().and_then(OsStr::to_str) {
                          if THUMBNAIL_EXTS.contains(ext.to_lowercase().as_str()) {
                             if let Some(mime) = get_mime_type_from_extension(ext) {
                                 if let Some(stem) = path.file_stem().and_then(OsStr::to_str) {
                                     let key = stem.to_lowercase();
                                     thumbnail_map.entry(key).or_insert((path.clone(), mime));
                                 }
                             }
                         }
                     }
                 }
             }
        }
    }

    if !is_empty {
        let dir_reader_entries = fs::read_dir(&maps_folder_path)
             .map_err(|e| format!("Failed read dir for entries {}: {}", maps_folder_path.display(), e))?;
        for entry_result in dir_reader_entries {
            if let Ok(entry) = entry_result {
                let path = entry.path();
                if let Ok(metadata) = entry.metadata() {
                    let name: Option<String> = entry.file_name().to_str().map(String::from);
                    let is_directory = metadata.is_dir();
                    if path.as_os_str().is_empty() || (name.is_none() && !is_directory) { continue; }

                    let should_include = if !is_directory {
                        match path.extension().and_then(OsStr::to_str) {
                            Some(ext) => !EXCLUDED_FILE_EXTS.contains(ext.to_lowercase().as_str()),
                            None => true,
                        }
                    } else {
                        true
                    };

                    if should_include {
                        let size = if is_directory { Some(calculate_directory_size(&path)) } else { Some(metadata.len()) };
                        let modified_time = system_time_to_millis(metadata.modified().ok()).or_else(|| system_time_to_millis(metadata.created().ok()));
                        let key = if is_directory { name.clone().map(|n| n.to_lowercase()) } else { path.file_stem().and_then(OsStr::to_str).map(str::to_lowercase) };
                        let (thumb_path, thumb_mime) = match key.and_then(|k| thumbnail_map.get(&k)) {
                            Some((p, m)) => (Some(p.clone()), Some(m.clone())),
                            None => (None, None),
                        };
                         map_entries.push(FsEntry { name, path, is_directory, size, modified: modified_time, thumbnail_path: thumb_path, thumbnail_mime_type: thumb_mime });
                    }
                } else { eprintln!("Error getting metadata for {}", path.display()); }
            } else { eprintln!("Error reading directory entry"); }
        }
    }

    map_entries.sort_by(|a, b| {
        a.name.as_deref().unwrap_or("").to_lowercase().cmp(&b.name.as_deref().unwrap_or("").to_lowercase())
    });

    let final_status = if is_empty { ListingStatus::ExistsAndEmpty } else { ListingStatus::ExistsAndPopulated };
    println!("[RUST] list_local_maps: END Status: {:?}, Count: {}", final_status, map_entries.len());
    Ok(DirectoryListingResult { status: final_status, entries: map_entries, path: maps_folder_path })
}

#[command]
pub fn list_directory_entries(absolute_path: String) -> Result<DirectoryListingResult, String> {
    let dir_path = PathBuf::from(absolute_path);
    println!("[RUST] list_directory_entries: Checking {}", dir_path.display());

    if !dir_path.exists() {
         return Ok(DirectoryListingResult { status: ListingStatus::DoesNotExist, entries: Vec::new(), path: dir_path });
    }
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path.display()));
    }

    let mut entries = Vec::new();
    let mut dir_reader = match fs::read_dir(&dir_path) {
        Ok(reader) => reader.peekable(),
        Err(e) => return Err(format!("Failed read dir {}: {}", dir_path.display(), e)),
    };

    let status = if dir_reader.peek().is_none() { ListingStatus::ExistsAndEmpty } else { ListingStatus::ExistsAndPopulated };

    if status == ListingStatus::ExistsAndPopulated {
         for entry_result in dir_reader {
             if let Ok(entry) = entry_result {
                 let path = entry.path();
                 if let Ok(metadata) = entry.metadata() {
                     let name = entry.file_name().to_str().map(String::from);
                     let is_directory = metadata.is_dir();
                     if path.as_os_str().is_empty() || (name.is_none() && !is_directory) { continue; }

                     let size = if is_directory { Some(calculate_directory_size(&path)) } else { Some(metadata.len()) };
                     let modified_time = system_time_to_millis(metadata.modified().ok()).or_else(|| system_time_to_millis(metadata.created().ok()));

                     entries.push(FsEntry { name, path, is_directory, size, modified: modified_time, thumbnail_path: None, thumbnail_mime_type: None });
                 } else { eprintln!("Warning: Could not get metadata {:?}", entry.path()); }
             } else { eprintln!("Warning: Could not read directory entry."); }
         }
     }

    entries.sort_by(|a, b| {
        if a.is_directory == b.is_directory { a.name.as_deref().unwrap_or("").to_lowercase().cmp(&b.name.as_deref().unwrap_or("").to_lowercase()) }
        else if a.is_directory { std::cmp::Ordering::Less }
        else { std::cmp::Ordering::Greater }
    });

    println!("[RUST] list_directory_entries: END Status: {:?}, Count: {}", status, entries.len());
    Ok(DirectoryListingResult { status, entries, path: dir_path })
}

#[command]
pub fn create_directory_rust(absolute_path: String) -> Result<(), String> {
    let path = PathBuf::from(absolute_path);
    println!("[RUST] create_directory_rust: {}", path.display());
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed create directory '{}': {}", path.display(), e))
}

#[command]
pub fn create_empty_file_rust(absolute_path: String) -> Result<(), String> {
    let path = PathBuf::from(absolute_path);
    println!("[RUST] create_empty_file_rust: {}", path.display());
    if let Some(parent) = path.parent() {
         if !parent.exists() {
             fs::create_dir_all(parent)
                .map_err(|e| format!("Failed create parent directory '{}': {}", parent.display(), e))?;
         }
    } else {
         return Err(format!("Cannot determine parent directory for '{}'", path.display()));
    }
    File::create(&path)
        .map(|_| ())
        .map_err(|e| format!("Failed create file '{}': {}", path.display(), e))
}

#[command]
pub fn rename_fs_entry_rust(old_absolute_path: String, new_absolute_path: String) -> Result<(), String> {
    let old_path = PathBuf::from(old_absolute_path);
    let new_path = PathBuf::from(new_absolute_path);
    println!("[RUST] rename_fs_entry_rust: {} -> {}", old_path.display(), new_path.display());

    if !old_path.exists() { return Err(format!("Source '{}' not found.", old_path.display())); }
    if new_path.exists() { return Err(format!("Target '{}' already exists.", new_path.display())); }
    if let Some(parent) = new_path.parent() {
         if !parent.exists() { return Err(format!("Target directory '{}' does not exist.", parent.display())); }
    } else {
         return Err(format!("Cannot determine parent directory for new path '{}'", new_path.display()));
    }

    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed rename '{}' to '{}': {}", old_path.display(), new_path.display(), e))
}

#[command]
pub fn delete_fs_entry_rust(absolute_path: String) -> Result<(), String> {
    let path = PathBuf::from(absolute_path);
    println!("[RUST] delete_fs_entry_rust: {}", path.display());
    if !path.exists() { return Ok(()); }

    if path.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| format!("Failed delete directory '{}': {}", path.display(), e))
    } else if path.is_file() {
        fs::remove_file(&path).map_err(|e| format!("Failed delete file '{}': {}", path.display(), e))
    } else {
        Err(format!("Path '{}' is neither a file nor a directory.", path.display()))
    }
}
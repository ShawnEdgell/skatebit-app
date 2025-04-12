// src-tauri/commands.rs

use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    ffi::OsStr,
    fs::{self, remove_file, File},
    io::copy,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use directories::UserDirs;
use tauri::{command, AppHandle, Emitter};
use tokio::task;
use uuid::Uuid;
use zip::ZipArchive;
use walkdir::WalkDir;

#[derive(Serialize, Clone, Debug)]
pub struct FsEntry {
    name: Option<String>,
    path: PathBuf,
    is_directory: bool,
    size: Option<u64>,
    modified: Option<u64>,
    thumbnail_path: Option<PathBuf>,
    thumbnail_mime_type: Option<String>,
}

fn calculate_directory_size(path: &Path) -> u64 {
    WalkDir::new(path).min_depth(1).max_depth(1).into_iter()
        .filter_map(|e| e.ok()).filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok()).map(|m| m.len()).sum()
}

fn system_time_to_millis(time: Option<SystemTime>) -> Option<u64> {
    time.and_then(|t| t.duration_since(UNIX_EPOCH).ok().map(|d| d.as_millis() as u64))
}

fn resolve_document_path(relative_path: &str) -> Result<PathBuf, String> {
    let user_dirs = UserDirs::new().ok_or("Could not determine user directories")?;
    let documents = user_dirs.document_dir().ok_or("Could not determine documents directory")?;
    Ok(documents.join(relative_path))
}

const THUMBNAIL_EXTS: [&str; 6] = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];
const EXCLUDED_FILE_EXTS: [&str; 8] = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "dll", "json"];

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
            if common_root.is_none() { common_root = Some(part); }
            else if common_root.as_ref() != Some(&part) { all_start_with_same_folder = false; }
        }
        if fallback_name.is_none() {
            if let Some(stem) = path.file_stem().and_then(OsStr::to_str) { fallback_name = Some(stem.to_string()); }
        }
    }
    let folder_name = if all_start_with_same_folder && top_levels.len() == 1 { common_root.unwrap() } else { fallback_name.unwrap_or_else(|| format!("map_{}", Uuid::new_v4())) };
    let target_dir = Path::new(&maps_folder).join(&folder_name);
    fs::create_dir_all(&target_dir).map_err(|e| format!("Failed create map folder {}: {}", target_dir.display(), e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let original_path = file.mangled_name();
        // *** FIX: Collect skipped components into PathBuf ***
        let stripped_path = if all_start_with_same_folder && top_levels.len() == 1 {
             original_path.components().skip(1).collect::<PathBuf>()
        } else { original_path.clone() };
        let outpath = target_dir.join(stripped_path);
        if file.name().ends_with('/') || file.is_dir() { fs::create_dir_all(&outpath).map_err(|e| format!("Failed create directory {:?}: {}", outpath, e))?; }
         else {
            if let Some(parent) = outpath.parent() { fs::create_dir_all(parent).map_err(|e| format!("Failed create parent dir {:?}: {}", parent, e))?; }
            let mut outfile = File::create(&outpath).map_err(|e| format!("Failed create file {:?}: {}", outpath, e))?;
            copy(&mut file, &mut outfile).map_err(|e| format!("Failed copy file to {:?}: {}", outpath, e))?;
            outfile.sync_all().map_err(|e| format!("Failed sync file {:?}: {}", outpath, e))?;
        }
    }
    remove_file(&zip_path).map_err(|e| format!("Failed remove zip file: {}", e))?;
    Ok(())
}

#[command]
pub fn save_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    let file_path = Path::new(&path);
    if let Some(parent) = file_path.parent() { fs::create_dir_all(parent).map_err(|e| format!("Failed create dir structure {}: {}", path, e))?; }
    fs::write(&file_path, &contents).map_err(|e| format!("Failed write file {}: {}", path, e))?;
    Ok(())
}

#[command(async)]
pub async fn download_and_install(url: String, destination: String, app_handle: AppHandle) -> Result<(), String> {
    let full_maps_folder_path = resolve_document_path(&destination)?;
    fs::create_dir_all(&full_maps_folder_path).map_err(|e| format!("Failed create destination dir {:?}: {}", full_maps_folder_path, e ))?;
    let response = reqwest::get(&url).await.map_err(|e| format!("Failed download {}: {}", url, e))?;
    if !response.status().is_success() { return Err(format!("Download failed status {}", response.status())); }
    let headers = response.headers().clone();
    let bytes = response.bytes().await.map_err(|e| format!("Failed read bytes: {}", e))?;
    let is_zip = bytes.len() >= 4 && bytes.starts_with(b"PK\x03\x04");
    if is_zip {
        let tmp_file_path = std::env::temp_dir().join(format!("downloaded_{}.zip", Uuid::new_v4()));
        fs::write(&tmp_file_path, &bytes).map_err(|e| format!("Error writing temp zip: {}", e))?;
        let zip_path = tmp_file_path.to_string_lossy().to_string();
        let maps_folder_str = full_maps_folder_path.to_string_lossy().to_string();
        let app_handle_clone = app_handle.clone();
        task::spawn_blocking(move || {
            let result = unzip_file(zip_path, maps_folder_str);
            if result.is_ok() { let _ = app_handle_clone.emit("maps-changed", "changed"); }
            result
        }).await.map_err(|e| format!("Unzip task panicked: {}", e))?
    } else {
        let filename = headers.get("content-disposition").and_then(|v| v.to_str().ok()).and_then(|c| c.split("filename=").nth(1)).map(|s| s.trim_matches('"').to_string()).unwrap_or_else(|| url.split('/').last().unwrap_or("downloaded_file").to_string());
        let file_path = full_maps_folder_path.join(filename);
        let result = save_file(file_path.to_string_lossy().to_string(), bytes.to_vec());
        if result.is_ok() { let _ = app_handle.emit("maps-changed", "changed"); }
        result
    }
}

#[command]
pub fn list_local_maps(relative_maps_path: String) -> Result<Vec<FsEntry>, String> {
    let maps_folder_path = resolve_document_path(&relative_maps_path)?;
    println!("[Rust CMD::list_local_maps] START - Path: {}", maps_folder_path.display());
    if !maps_folder_path.exists() { return Ok(Vec::new()); }
    let mut map_entries = Vec::new();
    let mut thumbnail_map: HashMap<String, (PathBuf, String)> = HashMap::new();
    for entry_result in fs::read_dir(&maps_folder_path).map_err(|e| e.to_string())? {
         if let Ok(entry) = entry_result { let path = entry.path(); let file_name_os = entry.file_name(); let file_name_str = file_name_os.to_string_lossy(); if path.is_dir() { let dir_name_lower = file_name_str.to_lowercase(); let mut found_thumbnail = false; for ext in THUMBNAIL_EXTS { let candidate_path = path.join(format!("{}.{}", file_name_str, ext)); if candidate_path.is_file() { if let Some(mime) = get_mime_type_from_extension(ext) { thumbnail_map.insert(dir_name_lower.clone(), (candidate_path, mime)); found_thumbnail = true; break; } } } if !found_thumbnail { if let Ok(sub_entries) = fs::read_dir(&path) { for sub_res in sub_entries { if let Ok(sub_entry) = sub_res { let sub_path = sub_entry.path(); if sub_path.is_file() { if let Some(ext) = sub_path.extension().and_then(OsStr::to_str) { if THUMBNAIL_EXTS.contains(&ext.to_lowercase().as_str()) { if let Some(mime) = get_mime_type_from_extension(ext) { thumbnail_map.insert(dir_name_lower.clone(), (sub_path, mime)); break; } } } } } } } } } else if path.is_file() { if let Some(ext) = path.extension().and_then(OsStr::to_str) { if THUMBNAIL_EXTS.contains(&ext.to_lowercase().as_str()) { if let Some(mime) = get_mime_type_from_extension(ext) { if let Some(stem) = path.file_stem().and_then(OsStr::to_str) { let key = stem.to_lowercase(); thumbnail_map.entry(key).or_insert((path.clone(), mime)); } } } } } } }
    let mut processed_count = 0; let mut skipped_count = 0; let mut error_count = 0;
    for entry_result in fs::read_dir(&maps_folder_path).map_err(|e| e.to_string())? { if let Ok(entry) = entry_result { let path = entry.path(); if let Ok(metadata) = entry.metadata() { let name: Option<String> = entry.file_name().to_str().map(String::from); let is_directory = metadata.is_dir(); if path.as_os_str().is_empty() { skipped_count += 1; continue; } if name.is_none() && !is_directory { skipped_count += 1; continue; } else if name.is_none() && is_directory { println!("WARN - Directory has NON-UTF8 name: {}", path.display()); } let should_include = if !is_directory { match path.extension().and_then(OsStr::to_str) { Some(ext) => !EXCLUDED_FILE_EXTS.contains(&ext.to_lowercase().as_str()), None => true } } else { true }; if should_include { let size = if is_directory { Some(calculate_directory_size(&path)) } else { Some(metadata.len()) }; let modified_time = system_time_to_millis(metadata.modified().ok()).or_else(|| system_time_to_millis(metadata.created().ok())); let key = if is_directory { name.clone().map(|n| n.to_lowercase()) } else { path.file_stem().and_then(OsStr::to_str).map(str::to_lowercase) }; let (thumb_path, thumb_mime) = match key.and_then(|k| thumbnail_map.get(&k)) { Some((p, m)) => (Some(p.clone()), Some(m.clone())), None => (None, None) }; let final_entry = FsEntry { name, path, is_directory, size, modified: modified_time, thumbnail_path: thumb_path, thumbnail_mime_type: thumb_mime, }; if final_entry.path.as_os_str().is_empty() || (final_entry.name.is_none() && !final_entry.is_directory) { eprintln!("!!! INTERNAL SKIP !!! Path='{}', Name='{:?}'", final_entry.path.display(), final_entry.name); skipped_count += 1; continue; } else { map_entries.push(final_entry); processed_count += 1; } } else { skipped_count += 1; } } else { eprintln!("!!! ERROR !!! Could not get metadata: {}. Skipping.", path.display()); error_count += 1; } } else { eprintln!("!!! ERROR !!! Could not read directory entry result. Skipping."); error_count += 1; } }
    map_entries.sort_by(|a, b| { a.name.as_deref().unwrap_or("").to_lowercase().cmp(&b.name.as_deref().unwrap_or("").to_lowercase()) });
    println!("[Rust CMD::list_local_maps] END - Processed: {}, Skipped: {}, Errors: {}. Returning {} entries.", processed_count, skipped_count, error_count, map_entries.len());
    Ok(map_entries)
}

#[command]
// *** Accept absolute_path: String, REMOVE resolve_document_path ***
pub fn list_directory_entries(absolute_path: String) -> Result<Vec<FsEntry>, String> {
    // Convert String to PathBuf
    let dir_path = PathBuf::from(absolute_path);
    println!("[Rust CMD::list_directory_entries] START - Path: {}", dir_path.display());

    // Check if path exists and is a directory
    if !dir_path.exists() { return Err(format!("Path does not exist: {}", dir_path.display())); }
    if !dir_path.is_dir() { return Err(format!("Path is not a directory: {}", dir_path.display())); }

    let mut entries = Vec::new();
    for entry_result in fs::read_dir(&dir_path).map_err(|e| format!("Failed read dir {}: {}", dir_path.display(), e))? {
       if let Ok(entry) = entry_result {
            let path = entry.path(); // path is already absolute here
            if let Ok(metadata) = entry.metadata() {
                 let name = entry.file_name().to_str().map(String::from);
                 let is_directory = metadata.is_dir();
                 // *** CRITICAL CHECK: Skip if path or name (for file) is invalid ***
                 if path.as_os_str().is_empty() { eprintln!("!!! SKIP entry with empty path"); continue; }
                 if name.is_none() && !is_directory { eprintln!("!!! SKIP file with invalid name: {}", path.display()); continue; }

                 let size = if is_directory { Some(calculate_directory_size(&path)) } else { Some(metadata.len()) };
                 let modified_time = system_time_to_millis(metadata.modified().ok()).or_else(|| system_time_to_millis(metadata.created().ok()));

                 entries.push(FsEntry { name, path, is_directory, size, modified: modified_time, thumbnail_path: None, thumbnail_mime_type: None });
            } else { eprintln!("Warning: Could not get metadata {:?}", entry.path()); }
       } else { eprintln!("Warning: Could not read directory entry."); }
    }
    entries.sort_by(|a, b| { if a.is_directory == b.is_directory { a.name.as_deref().unwrap_or("").to_lowercase().cmp(&b.name.as_deref().unwrap_or("").to_lowercase()) } else if a.is_directory { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater } });
    println!("[Rust CMD::list_directory_entries] END - Returning {} entries.", entries.len());
    Ok(entries)
}

// --- CRUD commands still use relative paths ---
#[command]
pub fn create_directory_rust(relative_path: String) -> Result<(), String> {
    let path = resolve_document_path(&relative_path)?;
    fs::create_dir_all(&path).map_err(|e| format!("Failed create directory '{}': {}", path.display(), e))
}

#[command]
pub fn create_empty_file_rust(relative_path: String) -> Result<(), String> {
    let path = resolve_document_path(&relative_path)?;
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| format!("Failed create parent directory '{}': {}", path.display(), e))?; }
    File::create(&path).map(|_| ()).map_err(|e| format!("Failed create file '{}': {}", path.display(), e))
}

#[command]
pub fn rename_fs_entry_rust(relative_dir_path: String, old_name: String, new_name: String) -> Result<(), String> {
    let dir_path = resolve_document_path(&relative_dir_path)?;
    if new_name.is_empty() || new_name.contains(['/', '\\']) { return Err("Invalid new name.".to_string()); }
    let old_path = dir_path.join(&old_name);
    let new_path = dir_path.join(&new_name);
    if !old_path.exists() { return Err(format!("Source '{}' not found.", old_path.display())); }
    if new_path.exists() { return Err(format!("Target '{}' already exists.", new_path.display())); }
    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed rename '{}' to '{}': {}", old_path.display(), new_path.display(), e))
}

#[command]
pub fn delete_fs_entry_rust(relative_path: String) -> Result<(), String> {
    let path = resolve_document_path(&relative_path)?;
    if !path.exists() { return Ok(()); } // Item not found is not an error for deletion
    if path.is_dir() { fs::remove_dir_all(&path).map_err(|e| format!("Failed delete directory '{}': {}", path.display(), e)) }
    else if path.is_file() { fs::remove_file(&path).map_err(|e| format!("Failed delete file '{}': {}", path.display(), e)) }
    else { Err(format!("Cannot delete unknown type: {}", path.display())) }
}
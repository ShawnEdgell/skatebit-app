// src-tauri/src/mod_commands.rs

//! Contains Tauri commands specifically for mod‑related operations.

use crate::error::{CommandError, CommandResult};
use crate::models::*;
use crate::utils::*;
use std::{
    collections::{hash_map::DefaultHasher, HashMap, HashSet},
    ffi::OsStr,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
};
use tauri::{command, Manager};

fn hash_path(path: &Path) -> String {
    let path_str = path.to_string_lossy();
    let mut hasher = DefaultHasher::new();
    path_str.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

fn cache_thumbnail_if_needed(
    original_thumbnail_path: &Path,
    original_mod_path: &Path,
    app_handle: &tauri::AppHandle,
) -> Option<PathBuf> {
    let base_cache_dir = app_handle.path().app_cache_dir().ok()?;
    let cache_dir = base_cache_dir.join("thumbnails").join("mods");
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir).ok()?;
    }

    let ext = original_thumbnail_path.extension().and_then(|e| e.to_str()).unwrap_or_default();
    let cache_filename = format!("{}.{}", hash_path(original_mod_path), ext);
    let cached_thumb_path = cache_dir.join(&cache_filename);

    if !cached_thumb_path.exists() {
        fs::copy(original_thumbnail_path, &cached_thumb_path).ok()?;
    }

    Some(cached_thumb_path)
}

#[command]
pub fn list_local_mods(
    app_handle: tauri::AppHandle,
    relative_maps_path: String,
) -> CommandResult<DirectoryListingResult> {
    // identical to list_local_maps but uses "mods" cache path
    let mods_folder_path =
        resolve_document_path(&relative_maps_path).map_err(CommandError::DirectoryResolution)?;

    if !mods_folder_path.exists() {
        return Ok(DirectoryListingResult {
            status: ListingStatus::DoesNotExist,
            entries: Vec::new(),
            path: mods_folder_path,
        });
    }
    if !mods_folder_path.is_dir() {
        return Err(CommandError::Input(format!(
            "Path exists but is not a directory: {}",
            mods_folder_path.display()
        )));
    }

    let mut mod_entries = Vec::new();
    let mut thumbnail_map: HashMap<String, (PathBuf, String)> = HashMap::new();
    let mut is_empty = true;

    let mut dir_reader_peek = match fs::read_dir(&mods_folder_path) {
        Ok(reader) => reader.peekable(),
        Err(e) => {
            return Err(CommandError::Io(format!(
                "Failed read dir (peek) {}: {}",
                mods_folder_path.display(),
                e
            )))
        }
    };

    if dir_reader_peek.peek().is_some() {
        is_empty = false;
        log::info!("[mod_commands::list_local_mods] Directory not empty. Scanning for thumbnails...");

        let dir_reader_thumbs = fs::read_dir(&mods_folder_path).map_err(|e| {
            CommandError::Io(format!(
                "Failed read dir (thumbs) {}: {}",
                mods_folder_path.display(),
                e
            ))
        })?;

        for entry_result in dir_reader_thumbs {
            if let Ok(entry) = entry_result {
                let path = entry.path();
                let file_name_os = entry.file_name();
                let file_name_str = file_name_os.to_string_lossy();

                if path.is_dir() {
                    let dir_name_lower = file_name_str.to_lowercase();
                    for ext in THUMBNAIL_EXTS.iter() {
                        let candidate = path.join(format!("{}.{}", file_name_str, ext));
                        if candidate.is_file() {
                            if let Some(mime) = get_mime_type_from_extension(ext) {
                                thumbnail_map.insert(dir_name_lower.clone(), (candidate, mime));
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    let mut valid_cached_filenames: HashSet<String> = HashSet::new();

    if !is_empty {
        let dir_reader_entries = fs::read_dir(&mods_folder_path).map_err(|e| {
            CommandError::Io(format!("Failed read dir (entries) {}: {}", mods_folder_path.display(), e))
        })?;

        for entry_result in dir_reader_entries {
            if let Ok(entry) = entry_result {
                let path = entry.path();
                let metadata = match entry.metadata() {
                    Ok(m) => m,
                    Err(e) => {
                        log::error!("[mod_commands::list_local_mods] Metadata error for {}: {}", path.display(), e);
                        continue;
                    }
                };
                let is_directory = metadata.is_dir();
                let name = entry.file_name().to_str().map(|s| s.to_string());

                let size = if is_directory {
                    Some(calculate_directory_size(&path))
                } else {
                    Some(metadata.len())
                };

                let modified_time = system_time_to_millis(metadata.modified().ok())
                    .or_else(|| system_time_to_millis(metadata.created().ok()));

                let key = if is_directory {
                    name.clone().map(|n| n.to_lowercase())
                } else {
                    path.file_stem().and_then(OsStr::to_str).map(str::to_lowercase)
                };

                let mut final_thumb_path: Option<PathBuf> = None;
                let mut final_thumb_mime: Option<String> = None;

                if let Some((thumb_path, thumb_mime)) = key.and_then(|k| thumbnail_map.get(&k)) {
                    if let Some(cached_path) = cache_thumbnail_if_needed(thumb_path, &path, &app_handle) {
                        if let Some(filename_osstr) = cached_path.file_name() {
                            valid_cached_filenames.insert(filename_osstr.to_string_lossy().to_string());
                        }
                        final_thumb_path = Some(cached_path);
                        final_thumb_mime = Some(thumb_mime.clone());
                    }
                }

                mod_entries.push(FsEntry {
                    name,
                    path,
                    is_directory,
                    size,
                    modified: modified_time,
                    thumbnail_path: final_thumb_path,
                    thumbnail_mime_type: final_thumb_mime,
                });
            }
        }
    }

    mod_entries.sort_by(|a, b| a.name.as_deref().unwrap_or("").cmp(b.name.as_deref().unwrap_or("")));

    let final_status = if is_empty {
        ListingStatus::ExistsAndEmpty
    } else {
        ListingStatus::ExistsAndPopulated
    };

    log::info!("[mod_commands::list_local_mods] END Status: {:?}, Count: {}", final_status, mod_entries.len());

    Ok(DirectoryListingResult {
        status: final_status,
        entries: mod_entries,
        path: mods_folder_path,
    })
}

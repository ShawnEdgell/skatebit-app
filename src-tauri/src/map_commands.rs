// src-tauri/src/map_commands.rs

//! Contains Tauri commands specifically for map‑related operations (symlinks, listing with thumbnails).

use crate::error::{CommandError, CommandResult};
use crate::models::*;
use crate::utils::*;
use junction;
use std::{
    collections::{hash_map::DefaultHasher, HashMap, HashSet},
    ffi::OsStr,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
};
use tauri::{command, Manager};

// --- Hash helper ---
fn hash_path(path: &Path) -> String {
    let path_str = path.to_string_lossy();
    let mut hasher = DefaultHasher::new();
    path_str.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Copies a thumbnail into the app cache and returns its new path.
fn cache_thumbnail_if_needed(
    original_thumbnail_path: &Path,
    original_map_path: &Path,
    app_handle: &tauri::AppHandle,
) -> Option<PathBuf> {
    let base_cache_dir = app_handle.path().app_cache_dir().ok()?;
    let cache_dir = base_cache_dir.join("thumbnails");
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir).ok()?;
    }

    let ext = original_thumbnail_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default();
    let cache_filename = format!("{}.{}", hash_path(original_map_path), ext);
    let cached_thumb_path = cache_dir.join(&cache_filename);

    if !cached_thumb_path.exists() {
        fs::copy(original_thumbnail_path, &cached_thumb_path).ok()?;
    }

    Some(cached_thumb_path)
}

#[command]
pub fn is_symlink(path: String) -> Result<bool, String> {
    let p = Path::new(&path);
    match fs::symlink_metadata(p) {
        Ok(meta) => Ok(meta.file_type().is_symlink()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(format!(
            "Failed checking symlink metadata for {}: {}",
            path, e
        )),
    }
}

/// Removes a symlink or junction at the given path.
fn platform_remove_symlink(link_path_str: &str) -> CommandResult<bool> {
    let target = Path::new(link_path_str);
    match fs::symlink_metadata(target) {
        Ok(meta) if meta.file_type().is_symlink() => {
            #[cfg(unix)]
            fs::remove_file(target)?;
            #[cfg(windows)]
            junction::delete(target)
                .map_err(|e| CommandError::Symlink(format!("Failed to delete junction: {}", e)))?;
            Ok(true)
        }
        Ok(_) => Ok(false),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(e.into()),
    }
}

#[command]
pub fn create_maps_symlink(new_folder: String, target_link: String) -> CommandResult<()> {
    let source = Path::new(&new_folder);
    let target = Path::new(&target_link);
    if !source.is_dir() {
        return Err(CommandError::Input(format!(
            "Source not a directory: {}",
            new_folder
        )));
    }

    match fs::symlink_metadata(target) {
        Ok(m) if m.file_type().is_symlink() => {
            let _ = platform_remove_symlink(&target_link)?;
        }
        Ok(m) if m.is_dir() => {
            let mut backup = format!("{}_backup", &target_link);
            let mut i = 1;
            while Path::new(&backup).exists() {
                backup = format!("{}_backup_{}", &target_link, i);
                i += 1;
            }
            fs::rename(target, &backup)?;
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.into()),
        Ok(_) => {
            return Err(CommandError::Input(format!(
                "Target '{}' exists but is not a symlink or dir. Remove it manually.",
                target_link
            )))
        }
    }

    #[cfg(unix)]
    std::os::unix::fs::symlink(source, target)?;
    #[cfg(windows)]
    junction::create(source, target)
        .map_err(|e| CommandError::Symlink(format!("Windows junction failed: {}", e)))?;

    Ok(())
}

#[command]
pub fn remove_maps_symlink(link_path_str: String) -> CommandResult<()> {
    let _ = platform_remove_symlink(&link_path_str)?;
    Ok(())
}

#[command]
pub fn list_local_maps(
    app_handle: tauri::AppHandle,
    relative_maps_path: String,
) -> CommandResult<DirectoryListingResult> {
    let maps_folder_path =
        resolve_document_path(&relative_maps_path).map_err(CommandError::DirectoryResolution)?;

    if !maps_folder_path.exists() {
        return Ok(DirectoryListingResult {
            status: ListingStatus::DoesNotExist,
            entries: Vec::new(),
            path: maps_folder_path,
        });
    }
    if !maps_folder_path.is_dir() {
        return Err(CommandError::Input(format!(
            "Path exists but is not a directory: {}",
            maps_folder_path.display()
        )));
    }

    let mut map_entries = Vec::new();
    let mut thumbnail_map: HashMap<String, (PathBuf, String)> = HashMap::new();
    let mut is_empty = true;

    // --- First Pass: Check for emptiness and find thumbnails ---
    let mut dir_reader_peek = match fs::read_dir(&maps_folder_path) {
        Ok(reader) => reader.peekable(),
        Err(e) => {
            return Err(CommandError::Io(format!(
                "Failed read dir (peek) {}: {}",
                maps_folder_path.display(),
                e
            )))
        }
    };

    if dir_reader_peek.peek().is_some() {
        is_empty = false;
        log::info!(
            "[map_commands::list_local_maps] Directory not empty. Scanning for thumbnails..."
        );
        // (Keep your existing thumbnail discovery logic here)
        let dir_reader_thumbs = fs::read_dir(&maps_folder_path).map_err(|e| {
            CommandError::Io(format!(
                "Failed read dir (thumbs) {}: {}",
                maps_folder_path.display(),
                e
            ))
        })?;
        for entry_result in dir_reader_thumbs {
            match entry_result {
                   Ok(entry) => {
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
                   Err(e) => log::error!(
                        "[map_commands::list_local_maps] Error reading directory entry during thumbnail scan: {}", e
                   ),
              }
        }
    } else {
        log::info!("[map_commands::list_local_maps] Directory is empty.");
    }

    // --- NEW: Set to store valid cached thumbnail filenames ---
    let mut valid_cached_filenames: HashSet<String> = HashSet::new();

    // --- Second Pass: Collect map entries ---
    log::info!("[map_commands::list_local_maps] Collecting final map entries...");
    if !is_empty {
        let dir_reader_entries = fs::read_dir(&maps_folder_path).map_err(|e| {
            CommandError::Io(format!(
                "Failed read dir (entries) {}: {}",
                maps_folder_path.display(),
                e
            ))
        })?;

        for entry_result in dir_reader_entries {
            match entry_result {
                Ok(entry) => {
                    let path = entry.path(); // path = original map path
                    match entry.metadata() {
                        Ok(metadata) => {
                            let name: Option<String> = entry.file_name().to_str().map(String::from);
                            let is_directory = metadata.is_dir();
                            if path.as_os_str().is_empty() || (name.is_none() && !is_directory) {
                                continue;
                            }
                            let should_include = if !is_directory {
                                match path.extension().and_then(OsStr::to_str) {
                                    Some(ext) => !EXCLUDED_FILE_EXTS.contains(ext.to_lowercase().as_str()),
                                    None => true,
                                }
                            } else {
                                true
                            };

                            if should_include {
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

                                let mut final_cached_thumb_path: Option<PathBuf> = None;
                                let mut final_thumb_mime: Option<String> = None;

                                if let Some((original_thumb_path, original_thumb_mime)) =
                                    key.and_then(|k| thumbnail_map.get(&k))
                                {
                                    // --- MODIFIED: Store valid cached filename ---
                                    if let Some(cached_path) = cache_thumbnail_if_needed(
                                        original_thumb_path,
                                        &path,
                                        &app_handle,
                                    ) {
                                        if let Some(filename_osstr) = cached_path.file_name() {
                                            // Convert OsStr to String, handle potential lossy conversion if needed
                                            valid_cached_filenames.insert(filename_osstr.to_string_lossy().to_string());
                                        }
                                        final_cached_thumb_path = Some(cached_path); // Assign the path for FsEntry
                                    }
                                    // --- END MODIFIED ---
                                    final_thumb_mime = Some(original_thumb_mime.clone());
                                }

                                map_entries.push(FsEntry {
                                    name,
                                    path,
                                    is_directory,
                                    size,
                                    modified: modified_time,
                                    thumbnail_path: final_cached_thumb_path, // Use cached path
                                    thumbnail_mime_type: final_thumb_mime,
                                });
                            }
                        }
                        Err(e) => log::error!(
                            "[map_commands::list_local_maps] Error getting metadata for {}: {}",
                            path.display(), e
                        ),
                    }
                }
                Err(e) => log::error!(
                    "[map_commands::list_local_maps] Error reading directory entry during final scan: {}", e
                ),
            }
        }
    }

    // --- Sort entries (remains the same) ---
    map_entries.sort_by(|a, b| {
        a.name
            .as_deref()
            .unwrap_or("")
            .to_lowercase()
            .cmp(&b.name.as_deref().unwrap_or("").to_lowercase())
    });

    // --- NEW: Cache Pruning Logic ---
    log::info!("[map_commands::list_local_maps] Pruning thumbnail cache...");
    match app_handle.path().app_cache_dir() {
        Ok(cache_base_dir) => {
            let subfolder = if maps_folder_path.to_string_lossy().to_lowercase().contains("mods") {
                "mods"
            } else {
                "maps"
            };
            let thumbnail_cache_dir = cache_base_dir.join("thumbnails").join(subfolder);
            if thumbnail_cache_dir.is_dir() {
                // Check if it IS a directory
                match fs::read_dir(&thumbnail_cache_dir) {
                    Ok(cache_entries) => {
                        for entry_res in cache_entries {
                            if let Ok(cache_entry) = entry_res {
                                let cached_file_path = cache_entry.path();
                                // Check if it's a file to avoid trying to remove subdirs
                                if cached_file_path.is_file() {
                                     if let Some(filename_osstr) = cached_file_path.file_name() {
                                          let filename_str = filename_osstr.to_string_lossy().to_string();
                                          // Check if this cached file is NOT in our set of valid files
                                          if !valid_cached_filenames.contains(&filename_str) {
                                               log::debug!("[map_commands::list_local_maps] Pruning orphaned cache file: {}", cached_file_path.display());
                                               match fs::remove_file(&cached_file_path) {
                                                    Ok(_) => log::info!("[map_commands::list_local_maps] Successfully pruned: {}", cached_file_path.display()),
                                                    Err(e) => log::warn!("[map_commands::list_local_maps] Failed to prune cache file {}: {}", cached_file_path.display(), e),
                                               }
                                          }
                                     }
                                }
                           } else {
                                log::warn!("[map_commands::list_local_maps] Failed to read entry in cache directory during prune");
                           }
                        }
                    }
                    Err(e) => log::warn!("[map_commands::list_local_maps] Failed read cache directory for pruning: {}", e),
                }
            } else {
                log::debug!("[map_commands::list_local_maps] Thumbnail cache directory not found or not a directory, skipping prune: {}", thumbnail_cache_dir.display());
            }
        }
        Err(e) => log::warn!(
            "[map_commands::list_local_maps] Could not resolve app cache directory for pruning: {}",
            e
        ),
    }
    // --- END Cache Pruning Logic ---

    let final_status = if is_empty {
        ListingStatus::ExistsAndEmpty
    } else {
        ListingStatus::ExistsAndPopulated
    };
    log::info!(
        "[map_commands::list_local_maps] END Status: {:?}, Count: {}",
        final_status,
        map_entries.len()
    );
    Ok(DirectoryListingResult {
        status: final_status,
        entries: map_entries,
        path: maps_folder_path,
    })
}

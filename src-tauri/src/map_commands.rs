//! Contains Tauri commands specifically for map-related operations (symlinks, listing with thumbnails).

use crate::error::{CommandError, CommandResult};
use crate::models::*;
use crate::utils::*;
use std::{
    collections::{hash_map::DefaultHasher, HashMap},
    ffi::OsStr,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
};
use tauri::{command, AppHandle, Manager}; // <-- Added Manager


// --- Hashing dependency is used within hash_path ---

fn hash_path(path: &Path) -> String {
    let path_str = path.to_string_lossy();
    let mut hasher = DefaultHasher::new();
    path_str.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}



fn cache_thumbnail_if_needed(
    original_thumbnail_path: &Path,
    original_map_path: &Path,
    app_handle: &AppHandle,
) -> Option<PathBuf> {
    // 1. Resolve Cache Directory (Handle the Result correctly)
    let base_cache_dir = match app_handle.path().app_cache_dir() {
        Ok(dir) => dir, // Extract PathBuf on success
        Err(e) => { // Handle the error from app_cache_dir()
            eprintln!("Could not resolve app cache directory: {}", e);
            return None; // Return None as the function signature expects Option
        }
    };

    let cache_dir = base_cache_dir.join("thumbnails"); // Now join on the extracted PathBuf

    // 2. Ensure Cache Directory Exists
    if !cache_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&cache_dir) {
            eprintln!(
                "Failed to create thumbnail cache directory {:?}: {}",
                cache_dir, e
            );
            return None;
        }
    }

    // ... rest of the function remains the same ...
    let extension = original_thumbnail_path
        .extension()
        .unwrap_or_default()
        .to_string_lossy();
    let unique_cache_filename = format!("{}.{}", hash_path(original_map_path), extension);
    let cached_thumb_path = cache_dir.join(&unique_cache_filename);

    if !cached_thumb_path.exists() {
        match std::fs::copy(&original_thumbnail_path, &cached_thumb_path) {
            Ok(_) => {
                println!(
                    "Cached thumbnail for map {:?} to {:?}",
                    original_map_path, cached_thumb_path
                );
            }
            Err(e) => {
                eprintln!(
                    "Failed to copy thumbnail from {:?} to {:?}: {}",
                    original_thumbnail_path, cached_thumb_path, e
                );
                return None;
            }
        }
    } else {
        // Trace logging removed, println commented out previously
    }

    Some(cached_thumb_path)
}

#[command]
pub fn create_maps_symlink(new_folder: String, target_link: String) -> CommandResult<()> {
    let target_path = Path::new(&target_link);
    let source_path = Path::new(&new_folder);

    // Replaced log::info!
    println!(
        "[map_commands::create_maps_symlink] Attempting. Source: '{}', Target: '{}'",
        new_folder,
        target_link
    );

    if !source_path.exists() {
        return Err(CommandError::Input(format!(
            "Source folder '{}' does not exist. Cannot create symlink.",
            new_folder
        )));
    }
    if !source_path.is_dir() {
        return Err(CommandError::Input(format!(
            "Source path '{}' is not a directory.",
            new_folder
        )));
    }

    match fs::symlink_metadata(target_path) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                // Replaced log::info!
                println!(
                    "[map_commands::create_maps_symlink] Target path '{}' exists and is a symlink. Removing old link.",
                    target_link
                );
                platform_remove_symlink(&target_link)
                    .map_err(|e| CommandError::Symlink(format!("Failed to remove existing symlink at target: {}", e)))?;
            } else if metadata.is_dir() {
                // Replaced log::info!
                println!(
                    "[map_commands::create_maps_symlink] Target path '{}' exists and is a directory. Backing it up.",
                    target_link
                );
                let mut backup_target_str = format!("{}_backup", &target_link);
                let mut counter = 1;
                while Path::new(&backup_target_str).exists() {
                    counter += 1;
                    backup_target_str = format!("{}_backup_{}", &target_link, counter);
                }
                 // Replaced log::info!
                println!("[map_commands::create_maps_symlink] Attempting to rename existing directory '{}' to '{}'", target_link, backup_target_str);
                fs::rename(target_path, &backup_target_str)
                    .map_err(|e| CommandError::Io(format!("Failed to backup directory '{}' to '{}': {}", target_link, backup_target_str, e)))?;
                // Replaced log::info!
                println!("[map_commands::create_maps_symlink] Successfully backed up existing directory to '{}'", backup_target_str);
            } else {
                return Err(CommandError::Input(format!(
                    "Target path '{}' exists but is not a symlink or directory. Please check/remove it manually.",
                    target_link
                )));
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
             // Replaced log::info!
            println!(
                "[map_commands::create_maps_symlink] Target path '{}' does not exist. Proceeding to create link.",
                target_link
            );
        }
        Err(e) => {
            return Err(CommandError::Io(format!(
                "Error checking metadata for target path '{}': {}",
                target_link, e
            )));
        }
    }

     // Replaced log::info!
    println!(
        "[map_commands::create_maps_symlink] Creating link from '{}' pointing TO '{}'",
        target_link,
        new_folder
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::symlink;
        symlink(source_path, target_path)
            .map_err(|e| CommandError::Symlink(format!("Failed to create unix symlink '{}' -> '{}': {}", target_link, new_folder, e)))?;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::symlink_dir;
        symlink_dir(source_path, target_path)
             .map_err(|e| CommandError::Symlink(format!("Failed to create windows directory symlink '{}' -> '{}': {}. Ensure app runs with privileges if needed.", target_link, new_folder, e)))?;
    }
    #[cfg(not(any(unix, windows)))]
    {
        return Err(CommandError::Operation(
            "Symlink creation not supported on this platform.".to_string(),
        ));
    }

    // Replaced log::info!
    println!(
        "[map_commands::create_maps_symlink] Successfully created symlink '{}' -> '{}'",
        target_link,
        new_folder
    );
    Ok(())
}

#[command]
pub fn remove_maps_symlink(link_path_str: String) -> CommandResult<()> {
     // Replaced log::info!
    println!(
        "[map_commands::remove_maps_symlink] Request received for path: {}",
        link_path_str
    );
    match platform_remove_symlink(&link_path_str) {
        Ok(removed) => {
             // Replaced log::info!
            println!(
                "[map_commands::remove_maps_symlink] Helper result: symlink_removed={}",
                removed
            );
            Ok(())
        }
        Err(e) => {
             // Replaced log::error!
            eprintln!(
                "[map_commands::remove_maps_symlink] Helper returned error: {}",
                e
            );
            Err(CommandError::Symlink(e))
        }
    }
}

#[command]
pub fn list_local_maps(
    app_handle: AppHandle, // Added AppHandle
    relative_maps_path: String,
) -> CommandResult<DirectoryListingResult> {
    let maps_folder_path = resolve_document_path(&relative_maps_path)
        .map_err(CommandError::DirectoryResolution)?;

    // Replaced log::info!
    println!(
        "[map_commands::list_local_maps] Checking {}",
        maps_folder_path.display()
    );

    if !maps_folder_path.exists() {
         // Replaced log::warn!
        eprintln!("[map_commands::list_local_maps] Path does not exist.");
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
         // Replaced log::info!
        println!("[map_commands::list_local_maps] Directory not empty. Scanning for thumbnails...");

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
                                            if let Some(ext) =
                                                sub_path.extension().and_then(OsStr::to_str)
                                            {
                                                if THUMBNAIL_EXTS
                                                    .contains(ext.to_lowercase().as_str())
                                                {
                                                    if let Some(mime) =
                                                        get_mime_type_from_extension(ext)
                                                    {
                                                        thumbnail_map.insert(
                                                            dir_name_lower.clone(),
                                                            (sub_path, mime),
                                                        );
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
                Err(e) =>
                 // Replaced log::error!
                 eprintln!(
                    "[map_commands::list_local_maps] Error reading directory entry during thumbnail scan: {}",
                    e
                ),
            }
        }
    } else {
         // Replaced log::info!
        println!("[map_commands::list_local_maps] Directory is empty.");
    }

     // Replaced log::info!
    println!("[map_commands::list_local_maps] Collecting final map entries...");
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
                                    Some(ext) => {
                                        !EXCLUDED_FILE_EXTS.contains(ext.to_lowercase().as_str())
                                    }
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
                                let modified_time =
                                    system_time_to_millis(metadata.modified().ok())
                                        .or_else(|| system_time_to_millis(metadata.created().ok()));

                                let key = if is_directory {
                                    name.clone().map(|n| n.to_lowercase())
                                } else {
                                    path.file_stem()
                                        .and_then(OsStr::to_str)
                                        .map(str::to_lowercase)
                                };

                                let mut final_cached_thumb_path: Option<PathBuf> = None;
                                let mut final_thumb_mime: Option<String> = None;

                                if let Some((original_thumb_path, original_thumb_mime)) =
                                    key.and_then(|k| thumbnail_map.get(&k))
                                {
                                    final_cached_thumb_path = cache_thumbnail_if_needed(
                                        original_thumb_path,
                                        &path,
                                        &app_handle,
                                    );
                                    final_thumb_mime = Some(original_thumb_mime.clone());
                                }

                                map_entries.push(FsEntry {
                                    name,
                                    path,
                                    is_directory,
                                    size,
                                    modified: modified_time,
                                    thumbnail_path: final_cached_thumb_path,
                                    thumbnail_mime_type: final_thumb_mime,
                                });
                            }
                        }
                        Err(e) =>
                         // Replaced log::error!
                         eprintln!(
                            "[map_commands::list_local_maps] Error getting metadata for {}: {}",
                            path.display(),
                            e
                        ),
                    }
                }
                Err(e) =>
                 // Replaced log::error!
                 eprintln!(
                    "[map_commands::list_local_maps] Error reading directory entry during final scan: {}",
                    e
                ),
            }
        }
    }

    map_entries.sort_by(|a, b| {
        a.name
            .as_deref()
            .unwrap_or("")
            .to_lowercase()
            .cmp(&b.name.as_deref().unwrap_or("").to_lowercase())
    });

    let final_status = if is_empty {
        ListingStatus::ExistsAndEmpty
    } else {
        ListingStatus::ExistsAndPopulated
    };
    // Replaced log::info!
    println!(
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
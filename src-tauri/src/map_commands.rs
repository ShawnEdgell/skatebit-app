//! Contains Tauri commands specifically for map-related operations (symlinks, listing with thumbnails).

use std::{
    collections::HashMap,
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
};
use tauri::command;

// Import shared models, utilities, and the custom error types
use crate::models::*;
use crate::utils::*;
use crate::error::{CommandError, CommandResult};


#[command]
pub fn create_maps_symlink(new_folder: String, target_link: String) -> CommandResult<()> {
    let target_path = Path::new(&target_link);
    let source_path = Path::new(&new_folder); // The user-selected folder where maps actually are

    println!(
        "[map_commands::create_maps_symlink] Attempting. Source: '{}', Target: '{}'",
        new_folder, target_link
    );

    // --- Validate Source Path ---
    if !source_path.exists() {
        return Err(CommandError::Input(format!(
            "Source folder '{}' does not exist. Cannot create symlink.",
            new_folder
        )));
    }
    if !source_path.is_dir() {
        // We expect to link TO a directory
        return Err(CommandError::Input(format!(
            "Source path '{}' is not a directory.",
            new_folder
        )));
    }

    // --- Handle Existing Target Path ---
    match fs::symlink_metadata(target_path) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                println!(
                    "[map_commands::create_maps_symlink] Target path '{}' exists and is a symlink. Removing old link.",
                    target_link
                );
                // Use the utility function, mapping its string error to CommandError::Symlink
                platform_remove_symlink(&target_link)
                    .map_err(|e| CommandError::Symlink(format!("Failed to remove existing symlink at target: {}", e)))?;
            } else if metadata.is_dir() {
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
                 println!("[map_commands::create_maps_symlink] Attempting to rename existing directory '{}' to '{}'", target_link, backup_target_str);
                fs::rename(target_path, &backup_target_str)
                    .map_err(|e| CommandError::Io(format!("Failed to backup directory '{}' to '{}': {}", target_link, backup_target_str, e)))?;
                 println!("[map_commands::create_maps_symlink] Successfully backed up existing directory to '{}'", backup_target_str);
            } else {
                 // Target Path Exists but is some other file type
                return Err(CommandError::Input(format!(
                    "Target path '{}' exists but is not a symlink or directory. Please check/remove it manually.",
                    target_link
                )));
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
             println!("[map_commands::create_maps_symlink] Target path '{}' does not exist. Proceeding to create link.", target_link);
             // Proceed to create the new link below...
        }
        Err(e) => {
             // Some other OS error checking the path
             return Err(CommandError::Io(format!("Error checking metadata for target path '{}': {}", target_link, e)));
        }
    }

    // --- Create the New Symlink ---
    println!(
        "[map_commands::create_maps_symlink] Creating link from '{}' pointing TO '{}'",
        target_link, new_folder
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
        // Use symlink_dir because we expect 'source_path' to be a directory
        symlink_dir(source_path, target_path)
             .map_err(|e| CommandError::Symlink(format!("Failed to create windows directory symlink '{}' -> '{}': {}. Ensure app runs with privileges if needed.", target_link, new_folder, e)))?;
    }
    #[cfg(not(any(unix, windows)))]
    {
        return Err(CommandError::Operation(
            "Symlink creation not supported on this platform.".to_string(),
        ));
    }

    println!(
        "[map_commands::create_maps_symlink] Successfully created symlink '{}' -> '{}'",
        target_link, new_folder
    );
    Ok(())
}


#[command]
pub fn remove_maps_symlink(link_path_str: String) -> CommandResult<()> {
    println!("[map_commands::remove_maps_symlink] Request received for path: {}", link_path_str);
    // Call the helper function, mapping its String error to CommandError::Symlink
    match platform_remove_symlink(&link_path_str) {
        Ok(removed) => {
            println!("[map_commands::remove_maps_symlink] Helper result: symlink_removed={}", removed);
            Ok(()) // Success whether removed or not needed
        }
        Err(e) => {
            eprintln!("[map_commands::remove_maps_symlink] Helper returned error: {}", e);
            // Propagate the error, wrapping it
            Err(CommandError::Symlink(e))
        }
    }
}

#[command]
pub fn list_local_maps(relative_maps_path: String) -> CommandResult<DirectoryListingResult> {
    // Resolve path using utility function, map error type
    let maps_folder_path = resolve_document_path(&relative_maps_path)
        .map_err(CommandError::DirectoryResolution)?;

    println!(
        "[map_commands::list_local_maps] Checking {}",
        maps_folder_path.display()
    );

    if !maps_folder_path.exists() {
         println!("[map_commands::list_local_maps] Path does not exist.");
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
    let mut is_empty = true; // Assume empty until proven otherwise

    // --- First Pass: Check for emptiness and find thumbnails ---
    // Use peekable to efficiently check if the directory is empty
    let mut dir_reader_peek = match fs::read_dir(&maps_folder_path) {
        Ok(reader) => reader.peekable(),
        Err(e) => return Err(CommandError::Io(format!("Failed read dir (peek) {}: {}", maps_folder_path.display(), e))),
    };

    if dir_reader_peek.peek().is_some() {
         is_empty = false; // Directory is not empty
         println!("[map_commands::list_local_maps] Directory not empty. Scanning for thumbnails...");

         // Need a new iterator for the actual thumbnail scan pass
         let dir_reader_thumbs = fs::read_dir(&maps_folder_path)
            .map_err(|e| CommandError::Io(format!("Failed read dir (thumbs) {}: {}", maps_folder_path.display(), e)))?;

         for entry_result in dir_reader_thumbs {
              match entry_result {
                   Ok(entry) => {
                        let path = entry.path();
                        let file_name_os = entry.file_name();
                        let file_name_str = file_name_os.to_string_lossy(); // Use lossy for robustness

                        if path.is_dir() {
                             // Look for thumbnail inside this directory
                             let dir_name_lower = file_name_str.to_lowercase();
                             let mut found_thumbnail = false;

                             // Check for file named exactly like dir + ext (e.g., MapFolder/MapFolder.png)
                             for ext in THUMBNAIL_EXTS.iter() {
                                  let candidate_path = path.join(format!("{}.{}", file_name_str, ext));
                                  if candidate_path.is_file() {
                                       if let Some(mime) = get_mime_type_from_extension(ext) { // Use util
                                             thumbnail_map.insert(dir_name_lower.clone(), (candidate_path, mime));
                                             found_thumbnail = true;
                                             break;
                                       }
                                  }
                             }

                             // If not found, look for *any* valid image file inside the dir
                             if !found_thumbnail {
                                  if let Ok(sub_entries) = fs::read_dir(&path) {
                                       for sub_res in sub_entries {
                                            if let Ok(sub_entry) = sub_res {
                                                 let sub_path = sub_entry.path();
                                                 if sub_path.is_file() {
                                                      if let Some(ext) = sub_path.extension().and_then(OsStr::to_str) {
                                                           if THUMBNAIL_EXTS.contains(ext.to_lowercase().as_str()) { // Use util static
                                                                if let Some(mime) = get_mime_type_from_extension(ext) { // Use util
                                                                     // Found a potential thumbnail, use it and stop searching this dir
                                                                     thumbnail_map.insert(dir_name_lower.clone(), (sub_path, mime));
                                                                     break; // Found one, move to next top-level entry
                                                                }
                                                           }
                                                      }
                                                 }
                                            }
                                            // Ignore errors reading sub-entries
                                       }
                                  }
                                  // Ignore errors reading sub-directory
                             }
                        } else if path.is_file() {
                             // Check if a standalone file is a potential thumbnail for a dir/entry with the same base name
                             if let Some(ext) = path.extension().and_then(OsStr::to_str) {
                                  if THUMBNAIL_EXTS.contains(ext.to_lowercase().as_str()) { // Use util static
                                       if let Some(mime) = get_mime_type_from_extension(ext) { // Use util
                                             if let Some(stem) = path.file_stem().and_then(OsStr::to_str) {
                                                  let key = stem.to_lowercase();
                                                  // Insert only if no thumbnail already found for this key (prefer dir contents)
                                                  thumbnail_map.entry(key).or_insert((path.clone(), mime));
                                             }
                                       }
                                  }
                             }
                        }
                   }
                   Err(e) => eprintln!("[map_commands::list_local_maps] Error reading directory entry during thumbnail scan: {}", e), // Log error but continue
              }
         }
    } else {
        println!("[map_commands::list_local_maps] Directory is empty.");
    }

    // --- Second Pass: Collect map entries ---
     println!("[map_commands::list_local_maps] Collecting final map entries...");
    if !is_empty {
        // Need a new iterator again for the final pass
         let dir_reader_entries = fs::read_dir(&maps_folder_path)
            .map_err(|e| CommandError::Io(format!("Failed read dir (entries) {}: {}", maps_folder_path.display(), e)))?;

        for entry_result in dir_reader_entries {
             match entry_result {
                  Ok(entry) => {
                       let path = entry.path();
                       match entry.metadata() {
                            Ok(metadata) => {
                                 let name: Option<String> = entry.file_name().to_str().map(String::from);
                                 let is_directory = metadata.is_dir();

                                 // Basic check for validity
                                 if path.as_os_str().is_empty() || (name.is_none() && !is_directory) { continue; }

                                 // Determine if this entry should be included based on extension/type
                                 let should_include = if !is_directory {
                                      match path.extension().and_then(OsStr::to_str) {
                                           Some(ext) => !EXCLUDED_FILE_EXTS.contains(ext.to_lowercase().as_str()), // Use util static
                                           None => true, // Include files with no extension
                                      }
                                 } else {
                                      true // Always include directories at this stage
                                 };

                                 if should_include {
                                      let size = if is_directory {
                                           Some(calculate_directory_size(&path)) // Use util
                                      } else {
                                           Some(metadata.len())
                                      };
                                      let modified_time = system_time_to_millis(metadata.modified().ok()) // Use util
                                           .or_else(|| system_time_to_millis(metadata.created().ok())); // Use util

                                      // Determine map key for thumbnail lookup (lowercase name)
                                      let key = if is_directory {
                                           name.clone().map(|n| n.to_lowercase())
                                      } else {
                                           path.file_stem().and_then(OsStr::to_str).map(str::to_lowercase)
                                      };

                                      // Get thumbnail from map if present
                                      let (thumb_path, thumb_mime) = match key.and_then(|k| thumbnail_map.get(&k)) {
                                           Some((p, m)) => (Some(p.clone()), Some(m.clone())),
                                           None => (None, None),
                                      };

                                      map_entries.push(FsEntry {
                                           name,
                                           path,
                                           is_directory,
                                           size,
                                           modified: modified_time,
                                           thumbnail_path: thumb_path,
                                           thumbnail_mime_type: thumb_mime,
                                      });
                                 }
                            }
                            Err(e) => eprintln!("[map_commands::list_local_maps] Error getting metadata for {}: {}", path.display(), e), // Log error but continue
                       }
                  }
                  Err(e) => eprintln!("[map_commands::list_local_maps] Error reading directory entry during final scan: {}", e), // Log error but continue
             }
        }
    }

    // Sort final entries alphabetically (case-insensitive)
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
//! Contains Tauri commands for general file system operations.

use std::{
    collections::HashSet,
    ffi::OsStr,
    fs::{self, remove_file, File},
    io::copy,
    path::PathBuf,
};
use tauri::command;
use uuid::Uuid;
use zip::ZipArchive;

// Import shared models and utilities
use crate::models::*;
use crate::utils::*;
// TODO: Replace String error type with a proper custom Error enum (e.g., from error.rs)
type CommandResult<T> = Result<T, String>;

#[command]
pub fn unzip_file(zip_path: String, target_base_folder: String) -> CommandResult<()> {
    println!("[fs_commands::unzip] Unzipping '{}' to base folder '{}'", zip_path, target_base_folder);
    let target_base_path = PathBuf::from(&target_base_folder);
    if !target_base_path.is_dir() {
        return Err(format!(
            "Target directory does not exist or is not a directory: {}",
            target_base_folder
        ));
    }

    let zip_file =
        File::open(&zip_path).map_err(|e| format!("Failed open zip {}: {}", zip_path, e))?;
    let mut archive =
        ZipArchive::new(zip_file).map_err(|e| format!("Failed read zip archive: {}", e))?;

    // --- Logic to determine the name of the folder to extract into ---
    let mut top_levels = HashSet::new();
    let mut fallback_name: Option<String> = None;
    let mut all_start_with_same_folder = true;
    let mut common_root: Option<String> = None;

    for i in 0..archive.len() {
        // Use ok() to ignore files ZipArchive can't read properly. Consider logging errors.
        if let Ok(file) = archive.by_index(i) {
            let path = file.mangled_name(); // Handles non-UTF8 paths gracefully

            // Get the first component of the path inside the zip
            if let Some(first_comp) = path.components().next() {
                // Convert OsStr component to String safely
                let part = first_comp.as_os_str().to_string_lossy().to_string();
                if !part.is_empty() { // Avoid issues with paths like "/"
                    top_levels.insert(part.clone());
                    if common_root.is_none() {
                        common_root = Some(part);
                    } else if common_root.as_ref() != Some(&part) {
                        all_start_with_same_folder = false;
                    }
                }
            }

            // Simple fallback name from first valid file stem found
            if fallback_name.is_none() {
                if let Some(stem) = path.file_stem().and_then(OsStr::to_str) {
                    if !stem.is_empty() {
                        fallback_name = Some(stem.to_string());
                    }
                }
            }
        } else {
            eprintln!("[fs_commands::unzip] Warning: Could not read file at index {} in zip '{}'", i, zip_path);
        }
    }

    // Determine the final output folder name inside target_base_folder
    let folder_name = if all_start_with_same_folder && top_levels.len() == 1 {
        common_root.unwrap() // We know it's Some if len == 1
    } else {
        // Use fallback, or generate UUID if no suitable name found
        fallback_name.unwrap_or_else(|| format!("unzipped_{}", Uuid::new_v4()))
    };

    let final_target_dir = target_base_path.join(&folder_name);
    println!("[fs_commands::unzip] Determined target directory: {}", final_target_dir.display());

    // Re-open the archive for extraction pass
    // Need to re-open file as ZipArchive consumes the reader
    let zip_file_extract =
        File::open(&zip_path).map_err(|e| format!("Failed re-open zip for extraction {}: {}", zip_path, e))?;
    let mut archive_extract =
        ZipArchive::new(zip_file_extract).map_err(|e| format!("Failed re-read zip archive for extraction: {}", e))?;


    // --- Extraction loop ---
    for i in 0..archive_extract.len() {
         // Use ok() and continue on error for more resilience
        let mut file = match archive_extract.by_index(i) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("[fs_commands::unzip] Error reading file index {} during extraction: {}", i, e);
                continue;
            }
        };

        let original_path = file.mangled_name();

        // Determine path relative to the common root if applicable
        let stripped_path = if all_start_with_same_folder && top_levels.len() == 1 {
            original_path.components().skip(1).collect::<PathBuf>()
        } else {
            original_path.clone() // Use clone to avoid borrowing issues if original_path is needed later
        };

        // Skip empty paths (e.g., result of stripping the only component)
        if stripped_path.as_os_str().is_empty() {
            continue;
        }

        let outpath = final_target_dir.join(&stripped_path); // Use reference here

        if file.name().ends_with('/') {
            // It's a directory entry
             println!("[fs_commands::unzip] Creating directory: {}", outpath.display());
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed create directory {:?}: {}", outpath, e))?;
        } else {
            // It's a file entry
             println!("[fs_commands::unzip] Extracting file: {}", outpath.display());
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed create parent dir {:?}: {}", parent, e))?;
                }
            }
            // Use try-catch approach for file creation and copy
            match File::create(&outpath) {
                Ok(mut outfile) => {
                    match copy(&mut file, &mut outfile) {
                         Ok(_) => {} // Successfully copied
                         Err(e) => eprintln!("[fs_commands::unzip] Warning: Failed to copy file content to {:?}: {}", outpath, e), // Log error but maybe continue? Or return Err here? Decide based on desired robustness.
                    }
                }
                Err(e) => {
                     eprintln!("[fs_commands::unzip] Warning: Failed create output file {:?}: {}", outpath, e);
                     // Decide whether to continue or return Err
                     // return Err(format!("Failed create file {:?}: {}", outpath, e));
                }
            }
        }
         // Set permissions on Unix - Consider adding this if needed
         #[cfg(unix)]
         {
             use std::os::unix::fs::PermissionsExt;
             if let Some(mode) = file.unix_mode() {
                  if let Err(e) = fs::set_permissions(&outpath, fs::Permissions::from_mode(mode)) {
                       eprintln!("[fs_commands::unzip] Warning: Failed to set permissions on {:?}: {}", outpath, e);
                  }
             }
         }
    }

    // Optionally remove the original zip file after successful extraction
    println!("[fs_commands::unzip] Extraction complete. Removing original zip: {}", zip_path);
    remove_file(&zip_path)
        .map_err(|e| format!("Failed remove original zip file {}: {}", zip_path, e))?;

    Ok(())
}


#[command]
pub fn save_file(absolute_path: String, contents: Vec<u8>) -> CommandResult<()> {
    let file_path = PathBuf::from(absolute_path);
    println!("[fs_commands::save_file] Saving {} bytes to {}", contents.len(), file_path.display());
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Failed create directory structure for {}: {}",
                file_path.display(),
                e
            )
        })?;
    }
    fs::write(&file_path, &contents)
        .map_err(|e| format!("Failed write file {}: {}", file_path.display(), e))?;
    Ok(())
}

#[command]
pub fn list_directory_entries(absolute_path: String) -> CommandResult<DirectoryListingResult> {
    let dir_path = PathBuf::from(absolute_path);
    println!("[fs_commands::list_directory_entries] Checking {}", dir_path.display());

    if !dir_path.exists() {
        println!("[fs_commands::list_directory_entries] Path does not exist.");
        return Ok(DirectoryListingResult {
            status: ListingStatus::DoesNotExist,
            entries: Vec::new(),
            path: dir_path,
        });
    }
    if !dir_path.is_dir() {
        return Err(format!(
            "Path exists but is not a directory: {}",
            dir_path.display()
        ));
    }

    let mut entries = Vec::new();
    let mut dir_reader = match fs::read_dir(&dir_path) {
        Ok(reader) => reader.peekable(), // Use peekable to check for emptiness
        Err(e) => {
            return Err(format!(
                "Failed read directory {}: {}",
                dir_path.display(),
                e
            ))
        }
    };

    let status = if dir_reader.peek().is_none() {
        println!("[fs_commands::list_directory_entries] Directory exists but is empty.");
        ListingStatus::ExistsAndEmpty
    } else {
         println!("[fs_commands::list_directory_entries] Directory exists and is populated.");
        ListingStatus::ExistsAndPopulated
    };

    // Only iterate if populated to avoid unnecessary work
    if status == ListingStatus::ExistsAndPopulated {
        // Need to re-read dir because peek consumed the first element check
         let dir_reader_entries = fs::read_dir(&dir_path)
            .map_err(|e| format!("Failed re-read directory {}: {}", dir_path.display(), e))?;

        for entry_result in dir_reader_entries {
            if let Ok(entry) = entry_result {
                let path = entry.path();
                if let Ok(metadata) = entry.metadata() {
                    let name = entry.file_name().to_str().map(String::from);
                    let is_directory = metadata.is_dir();

                    // Basic check to skip potentially invalid entries
                    if path.as_os_str().is_empty() || (name.is_none() && !is_directory) {
                        continue;
                    }

                    // Calculate size (using helper for dirs) and get modified time
                    let size = if is_directory {
                        Some(calculate_directory_size(&path)) // Call utility function
                    } else {
                        Some(metadata.len())
                    };
                    let modified_time = system_time_to_millis(metadata.modified().ok()) // Call utility
                        .or_else(|| system_time_to_millis(metadata.created().ok())); // Fallback to created

                    entries.push(FsEntry {
                        name,
                        path,
                        is_directory,
                        size,
                        modified: modified_time,
                        thumbnail_path: None, // Not relevant for generic listing
                        thumbnail_mime_type: None, // Not relevant for generic listing
                    });
                } else {
                    eprintln!(
                        "[fs_commands::list_directory_entries] Warning: Could not get metadata for {:?}",
                        entry.path()
                    );
                }
            } else {
                eprintln!("[fs_commands::list_directory_entries] Warning: Could not read directory entry.");
            }
        }
    }

    // Sort entries: directories first, then alphabetically
    entries.sort_by(|a, b| {
        if a.is_directory == b.is_directory {
            // Both are files or both are dirs: sort by name case-insensitively
            a.name
                .as_deref()
                .unwrap_or("") // Treat None name as empty string for sorting
                .to_lowercase()
                .cmp(&b.name.as_deref().unwrap_or("").to_lowercase())
        } else if a.is_directory {
            // a is dir, b is file: a comes first
            std::cmp::Ordering::Less
        } else {
            // a is file, b is dir: a comes second
            std::cmp::Ordering::Greater
        }
    });

    println!(
        "[fs_commands::list_directory_entries] END Status: {:?}, Count: {}",
        status,
        entries.len()
    );
    Ok(DirectoryListingResult {
        status,
        entries,
        path: dir_path,
    })
}


#[command]
pub fn create_directory_rust(absolute_path: String) -> CommandResult<()> {
    let path = PathBuf::from(absolute_path);
    println!("[fs_commands::create_directory_rust] {}", path.display());
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed create directory '{}': {}", path.display(), e))
}

#[command]
pub fn create_empty_file_rust(absolute_path: String) -> CommandResult<()> {
    let path = PathBuf::from(absolute_path);
    println!("[fs_commands::create_empty_file_rust] {}", path.display());

    // Ensure parent directory exists first
    if let Some(parent) = path.parent() {
        if !parent.exists() {
             println!("[fs_commands::create_empty_file_rust] Parent dir doesn't exist, creating: {}", parent.display());
            fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "Failed create parent directory '{}': {}",
                    parent.display(),
                    e
                )
            })?;
        }
    } else {
        // This case should be rare (e.g., creating a file in root "/file.txt" on Unix)
        return Err(format!(
            "Cannot determine parent directory for '{}'",
            path.display()
        ));
    }

    // Create the empty file
    File::create(&path)
        .map(|_| ()) // Discard the File handle, just indicate success
        .map_err(|e| format!("Failed create file '{}': {}", path.display(), e))
}

#[command]
pub fn rename_fs_entry_rust(
    old_absolute_path: String,
    new_absolute_path: String,
) -> CommandResult<()> {
    let old_path = PathBuf::from(old_absolute_path);
    let new_path = PathBuf::from(new_absolute_path);
    println!(
        "[fs_commands::rename_fs_entry_rust] {} -> {}",
        old_path.display(),
        new_path.display()
    );

    // Pre-checks
    if !old_path.exists() {
        return Err(format!("Source path '{}' not found.", old_path.display()));
    }
    if new_path.exists() {
        return Err(format!(
            "Target path '{}' already exists.",
            new_path.display()
        ));
    }
    // Check if parent directory of the *new* path exists
    if let Some(parent) = new_path.parent() {
        if !parent.exists() {
            return Err(format!(
                "Target directory '{}' does not exist.",
                parent.display()
            ));
        }
         if !parent.is_dir() {
              return Err(format!(
                   "Target parent path '{}' is not a directory.", parent.display()
              ));
         }
    } else {
        return Err(format!(
            "Cannot determine parent directory for new path '{}'",
            new_path.display()
        ));
    }

    // Perform the rename
    fs::rename(&old_path, &new_path).map_err(|e| {
        format!(
            "Failed rename '{}' to '{}': {}",
            old_path.display(),
            new_path.display(),
            e
        )
    })
}

#[command]
pub fn delete_fs_entry_rust(absolute_path: String) -> CommandResult<()> {
    let path = PathBuf::from(absolute_path);
    println!("[fs_commands::delete_fs_entry_rust] {}", path.display());

    // Check if path exists before attempting deletion
    if !path.exists() {
         println!("[fs_commands::delete_fs_entry_rust] Path does not exist, nothing to delete.");
        return Ok(()); // Nothing to delete, operation is technically successful
    }

    // Use metadata to determine if it's a file or directory
    // Using symlink_metadata to avoid following symlinks during check
    match fs::symlink_metadata(&path) {
         Ok(metadata) => {
              if metadata.is_dir() {
                   println!("[fs_commands::delete_fs_entry_rust] Path is a directory, removing recursively.");
                   fs::remove_dir_all(&path).map_err(|e| format!("Failed delete directory '{}': {}", path.display(), e))
              } else if metadata.is_file() || metadata.file_type().is_symlink() {
                  // Treat regular files and symlinks (both file and dir links) the same way for removal: remove_file
                  // platform_remove_symlink could be used for symlinks if more specific handling is needed,
                  // but remove_file often works for symlinks too, especially on Unix.
                  // remove_dir is needed for dir symlinks on Windows, but remove_dir_all handles dirs.
                  // Let's keep it simple: remove_file for non-dirs.
                   println!("[fs_commands::delete_fs_entry_rust] Path is a file or symlink, removing.");
                  fs::remove_file(&path).map_err(|e| format!("Failed delete file/symlink '{}': {}", path.display(), e))
              } else {
                  Err(format!("Path '{}' exists but is of an unknown or unsupported file type.", path.display()))
              }
         }
         Err(e) => {
              // If we failed to get metadata even though exists() was true (race condition?), report error.
              Err(format!("Failed to get metadata for existing path '{}': {}", path.display(), e))
         }
    }
}
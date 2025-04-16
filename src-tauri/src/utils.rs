//! Contains shared utility functions, constants, and helper logic.

use directories::UserDirs;
use once_cell::sync::Lazy;
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use walkdir::WalkDir;


// --- Constants / Static Data ---

/// Set of file extensions considered for generating thumbnails in list_local_maps.
pub static THUMBNAIL_EXTS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    ["png", "jpg", "jpeg", "gif", "webp", "bmp"]
        .iter()
        .cloned()
        .collect()
});

/// Set of file extensions excluded when listing maps in list_local_maps.
pub static EXCLUDED_FILE_EXTS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        // Image formats (often thumbnails themselves, not maps)
        "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico",
        // Executables and system files
        "dll", "exe", "bat", "msi",
        // Configuration and metadata files
        "json", "ini", "bak", "cfg", "tmp", "log", "txt", "rtf", "xml",
        // Archives and compressed files (handled separately by unzip)
        "zip", "rar", "7z", "tar", "gz",
        // Database and lock files
        "db", "sqlite", "lock",
        // Document files (if not relevant maps)
        "md", "doc", "docx", "pdf",
        // Media files (if not meant to be maps)
        "mp3", "mp4", "avi", "mov", "mkv", "flv", "wav",
        // Shortcut files
        "lnk",
        // Debug or symbol files
        "pdb",
        // Source code files (unlikely to be maps)
        "rs", "js", "ts", "html", "css", "py", "java", "cpp", "c", "h",
        // System / hidden files (often start with '.')
        // Note: WalkDir might handle hidden files differently based on OS,
        // this list is an explicit exclusion based on extension.
    ]
    .iter()
    .cloned()
    .collect()
});


// --- Helper Functions ---

/// Calculates the total size of immediate child files within a directory.
/// Note: Does not recurse into subdirectories for size calculation.
pub fn calculate_directory_size(path: &Path) -> u64 {
    WalkDir::new(path)
        .min_depth(1) // Only direct children
        .max_depth(1) // Only direct children
        .into_iter()
        .filter_map(Result::ok) // Ignore potential errors reading entries
        .filter(|e| e.file_type().is_file()) // Only count files
        .filter_map(|e| e.metadata().ok()) // Get metadata, ignore errors
        .map(|m| m.len()) // Get file size
        .sum() // Sum all sizes
}

/// Converts an Option<SystemTime> to milliseconds since UNIX_EPOCH.
pub fn system_time_to_millis(time: Option<SystemTime>) -> Option<u64> {
    time.and_then(|t| {
        t.duration_since(UNIX_EPOCH)
            .ok()
            .map(|d| d.as_millis() as u64) // Note: Cast to u64 might truncate on far future dates
    })
}

/// Resolves a path relative to the user's Documents directory.
pub fn resolve_document_path(relative_path: &str) -> Result<PathBuf, String> {
    let user_dirs = UserDirs::new()
        .ok_or_else(|| "Could not determine user directories".to_string())?;
    let documents = user_dirs
        .document_dir()
        .ok_or_else(|| "Could not determine documents directory".to_string())?;
    Ok(documents.join(relative_path))
}

/// Gets a basic image MIME type from a file extension (lowercase).
pub fn get_mime_type_from_extension(extension: &str) -> Option<String> {
    match extension.to_lowercase().as_str() {
        "png" => Some("image/png".to_string()),
        "jpg" | "jpeg" => Some("image/jpeg".to_string()),
        "gif" => Some("image/gif".to_string()),
        "webp" => Some("image/webp".to_string()),
        "bmp" => Some("image/bmp".to_string()),
        _ => None,
    }
}

/// Removes a symlink in a platform-aware manner.
/// Returns Ok(true) if removed, Ok(false) if not found or not a symlink, Err on OS error.
pub fn platform_remove_symlink(link_path_str: &str) -> Result<bool, String> {
    let link_path = Path::new(link_path_str);
    println!("[platform_remove_symlink] Checking path: {}", link_path_str);

    match fs::symlink_metadata(link_path) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                println!("[platform_remove_symlink] Path is a symlink. Attempting removal...");
                #[cfg(windows)]
                {
                    // For directory symlinks (common case), remove_dir is often needed. Try it first.
                    match fs::remove_dir(link_path) {
                         Ok(_) => {
                              println!("[platform_remove_symlink] Removed symlink using remove_dir: {}", link_path_str);
                              Ok(true)
                         }
                         Err(e_dir) => {
                              println!("[platform_remove_symlink] remove_dir failed ({}). Trying remove_file...", e_dir);
                              // Fallback to remove_file for file symlinks or other cases
                              match fs::remove_file(link_path) {
                                   Ok(_) => {
                                        println!("[platform_remove_symlink] Removed symlink using remove_file: {}", link_path_str);
                                        Ok(true)
                                   }
                                   Err(e_file) => Err(format!("Failed to remove symlink '{}' with remove_dir ({}) and remove_file ({}). Check permissions.", link_path_str, e_dir, e_file)),
                              }
                         }
                    }
                }
                #[cfg(unix)]
                {
                    // On Unix, remove_file usually works for all symlinks.
                    fs::remove_file(link_path)
                        .map(|_| {
                            println!("[platform_remove_symlink] Removed symlink using remove_file: {}", link_path_str);
                            true // Indicate removal happened
                        })
                        .map_err(|e| format!("Failed to remove unix symlink '{}': {}", link_path_str, e))
                }
                #[cfg(not(any(unix, windows)))]
                {
                     // Basic fallback
                     println!("Symlink removal may not be fully supported on this platform. Attempting remove_file.");
                     fs::remove_file(link_path)
                          .map(|_| true)
                          .map_err(|e| format!("Failed to remove symlink '{}': {}", link_path_str, e))

                }
            } else {
                println!("[platform_remove_symlink] Path exists but is not a symlink. No removal needed: {}", link_path_str);
                Ok(false) // Not a symlink, nothing removed
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            println!("[platform_remove_symlink] Path does not exist. No removal needed: {}", link_path_str);
            Ok(false) // Not found, nothing removed
        }
        Err(e) => Err(format!("[platform_remove_symlink] Error checking metadata for '{}': {}", link_path_str, e)),
    }
}
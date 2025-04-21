// src-tauri/src/utils.rs

//! Contains shared utility functions, constants, and helper logic.

use directories::UserDirs;
use once_cell::sync::Lazy;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use walkdir::WalkDir;

/// Generates a simple hash string from a Path, useful for cache keys.
pub fn hash_path(path: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    path.to_string_lossy().hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

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
        "dll", "exe", "bat", "msi", // Configuration and metadata files
        "json", "ini", "bak", "cfg", "tmp", "log", "txt", "rtf", "xml",
        // Archives and compressed files (handled separately by unzip)
        "zip", "rar", "7z", "tar", "gz", // Database and lock files
        "db", "sqlite", "lock", // Document files (if not relevant maps)
        "md", "doc", "docx", "pdf", // Media files (if not meant to be maps)
        "mp3", "mp4", "avi", "mov", "mkv", "flv", "wav", // Shortcut files
        "lnk", // Debug or symbol files
        "pdb", // Source code files (unlikely to be maps)
        "rs", "js", "ts", "html", "css", "py", "java", "cpp", "c",
        "h",
        // System / hidden files (often start with '.')
        // Note: WalkDir might handle hidden files differently based on OS,
        // this list is an explicit exclusion based on extension.
    ]
    .iter()
    .cloned()
    .collect()
});

/// Calculates the total size of immediate child files within a directory.
/// Note: Does not recurse into subdirectories for size calculation.
pub fn calculate_directory_size(path: &Path) -> u64 {
    WalkDir::new(path)
        .min_depth(1) // Only direct children
        .max_depth(1) // Only direct children
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

/// Converts an Option<SystemTime> to milliseconds since UNIX_EPOCH.
pub fn system_time_to_millis(time: Option<SystemTime>) -> Option<u64> {
    time.and_then(|t| {
        t.duration_since(UNIX_EPOCH)
            .ok()
            .map(|d| d.as_millis() as u64)
    })
}

/// Resolves a path relative to the user's Documents directory.
pub fn resolve_document_path(relative_path: &str) -> Result<PathBuf, String> {
    let user_dirs =
        UserDirs::new().ok_or_else(|| "Could not determine user directories".to_string())?;
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

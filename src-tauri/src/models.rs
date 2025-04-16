//! Contains shared data structures used across multiple command modules.

use serde::Serialize;
use std::path::PathBuf;

/// Represents the status of a directory listing operation.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ListingStatus {
    ExistsAndPopulated,
    ExistsAndEmpty,
    DoesNotExist,
}

/// Holds the result of a directory listing operation.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListingResult {
    pub status: ListingStatus,
    pub entries: Vec<FsEntry>,
    pub path: PathBuf,
}

/// Represents a single file system entry (file or directory).
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: Option<String>,
    pub path: PathBuf,
    pub is_directory: bool,
    pub size: Option<u64>, // Calculated for directories, actual for files
    pub modified: Option<u64>, // Milliseconds since UNIX_EPOCH
    pub thumbnail_path: Option<PathBuf>, // Populated specifically in list_local_maps
    pub thumbnail_mime_type: Option<String>, // Populated specifically in list_local_maps
}
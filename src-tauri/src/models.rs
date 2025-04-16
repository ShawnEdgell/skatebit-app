// src-tauri/src/models.rs

//! Contains shared data structures used across multiple command modules.

use serde::{Serialize, Deserialize}; // Add Deserialize if needed by frontend or internal use
use std::path::PathBuf;

/// Represents the status of a directory listing operation.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)] // Added Deserialize, PartialEq
#[serde(rename_all = "camelCase")]
pub enum ListingStatus {
    ExistsAndPopulated,
    ExistsAndEmpty,
    DoesNotExist,
}

/// Holds the result of a directory listing operation.
#[derive(Serialize, Deserialize, Clone, Debug)] // Added Deserialize
#[serde(rename_all = "camelCase")]
pub struct DirectoryListingResult {
    pub status: ListingStatus,
    pub entries: Vec<FsEntry>,
    pub path: PathBuf, // Keep PathBuf for Rust internal use
}

/// Represents a single file system entry (file or directory).
#[derive(Serialize, Deserialize, Clone, Debug)] // Added Deserialize
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: Option<String>,
    #[serde(serialize_with = "serialize_pathbuf", deserialize_with = "deserialize_pathbuf")] // Serialize PathBuf as string
    pub path: PathBuf,
    pub is_directory: bool,
    #[serde(skip_serializing_if = "Option::is_none")] // Don't include size if None
    pub size: Option<u64>, // Calculated for directories, actual for files
    #[serde(skip_serializing_if = "Option::is_none")] // Don't include modified if None
    pub modified: Option<u64>, // Milliseconds since UNIX_EPOCH
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(serialize_with = "serialize_optional_pathbuf", deserialize_with = "deserialize_optional_pathbuf")] // Handle optional PathBuf
    pub thumbnail_path: Option<PathBuf>, // Populated specifically in list_local_maps
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_mime_type: Option<String>, // Populated specifically in list_local_maps
}

// --- Add these NEW Structs and Enum below ---

/// Represents the progress of an installation operation.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")] // Match JS/TS conventions if preferred
pub struct InstallationProgress {
    pub step: String, // e.g., "downloading", "extracting", "complete", "error"
    pub progress: f64, // 0.0 to 1.0 (0.0 for indeterminate steps like 'starting')
    pub message: String,
    pub source: String, // The original URL or path being processed
}

/// Represents the final result of an installation or processing operation.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstallationResult {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(serialize_with = "serialize_optional_pathbuf", deserialize_with = "deserialize_optional_pathbuf")] // Handle optional PathBuf
    pub final_path: Option<PathBuf>, // Where it was extracted/saved to
    pub source: String, // Original source URL or path
}

// --- Helper functions for PathBuf serialization ---

fn serialize_pathbuf<S>(path: &PathBuf, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&path.to_string_lossy())
}

fn deserialize_pathbuf<'de, D>(deserializer: D) -> Result<PathBuf, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    Ok(PathBuf::from(s))
}

fn serialize_optional_pathbuf<S>(opt_path: &Option<PathBuf>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    match opt_path {
        Some(path) => serializer.serialize_some(&path.to_string_lossy()),
        None => serializer.serialize_none(),
    }
}

fn deserialize_optional_pathbuf<'de, D>(deserializer: D) -> Result<Option<PathBuf>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt_s: Option<String> = Option::deserialize(deserializer)?;
    Ok(opt_s.map(PathBuf::from))
}
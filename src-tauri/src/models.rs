// src-tauri/src/models.rs

//! Contains shared data structures used across multiple command modules.

use serde::{Serialize, Deserialize}; 
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)] 
#[serde(rename_all = "camelCase")]
pub enum ListingStatus {
    ExistsAndPopulated,
    ExistsAndEmpty,
    DoesNotExist,
}

#[derive(Serialize, Deserialize, Clone, Debug)] 
#[serde(rename_all = "camelCase")]
pub struct DirectoryListingResult {
    pub status: ListingStatus,
    pub entries: Vec<FsEntry>,
    pub path: PathBuf, 
}

#[derive(Serialize, Deserialize, Clone, Debug)] 
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: Option<String>,
    #[serde(serialize_with = "serialize_pathbuf", deserialize_with = "deserialize_pathbuf")] // Serialize PathBuf as string
    pub path: PathBuf,
    pub is_directory: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")] 
    pub modified: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(serialize_with = "serialize_optional_pathbuf", deserialize_with = "deserialize_optional_pathbuf")] // Handle optional PathBuf
    pub thumbnail_path: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_mime_type: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstallationProgress {
    pub step: String,
    pub progress: f64,
    pub message: String,
    pub source: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstallationResult {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(serialize_with = "serialize_optional_pathbuf", deserialize_with = "deserialize_optional_pathbuf")] // Handle optional PathBuf
    pub final_path: Option<PathBuf>,
    pub source: String, 
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
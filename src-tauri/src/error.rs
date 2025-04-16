//! Defines the custom error type and result alias for Tauri commands.

use serde::Serialize;
use thiserror::Error; // Make sure to add `thiserror = "1.0"` to Cargo.toml under [dependencies]

/// Custom error enumeration for command failures.
/// Derives Serialize for sending errors to the frontend and Error/Debug for error handling.
#[derive(Debug, Error, Serialize)]
pub enum CommandError {
    #[error("Filesystem Error: {0}")]
    Io(String),

    #[error("Directory Resolution Error: {0}")]
    DirectoryResolution(String),

    #[error("Zip Archive Error: {0}")]
    Zip(String),

    #[error("Network Error: {0}")]
    Network(String),

    #[error("Symlink Operation Error: {0}")]
    Symlink(String),

    #[error("Download Error: Status {status_code} - {message}")]
    Download { status_code: u16, message: String },

    #[error("Background Task Error: {0}")]
    TaskJoin(String),

    #[error("Invalid Input or State: {0}")]
    Input(String),

    #[error("Operation Failed: {0}")]
    Operation(String), // General failure category

    // #[error("Unknown Error: {0}")]
    // Unknown(String), // Catch-all
}

/// Type alias for Result used by Tauri commands.
pub type CommandResult<T> = Result<T, CommandError>;

// --- Optional: Implement From<T> for common errors ---
// This allows using `?` directly on some error types, but manual mapping
// often gives better context in the error message. Choose based on preference.

// Example: From std::io::Error
impl From<std::io::Error> for CommandError {
    fn from(e: std::io::Error) -> Self {
        CommandError::Io(e.to_string())
    }
}

// Example: From reqwest::Error
impl From<reqwest::Error> for CommandError {
    fn from(e: reqwest::Error) -> Self {
        CommandError::Network(e.to_string())
    }
}

// Example: From zip::result::ZipError
impl From<zip::result::ZipError> for CommandError {
     fn from(e: zip::result::ZipError) -> Self {
         CommandError::Zip(e.to_string())
     }
}

// Example: From tokio::task::JoinError
impl From<tokio::task::JoinError> for CommandError {
     fn from(e: tokio::task::JoinError) -> Self {
         CommandError::TaskJoin(e.to_string())
     }
}

// You might still prefer map_err for more specific messages, e.g.:
// fs::read_to_string("file").map_err(|e| CommandError::Io(format!("Failed to read 'file': {}", e)))?;
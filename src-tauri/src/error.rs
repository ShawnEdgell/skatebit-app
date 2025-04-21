use serde::Serialize;
use thiserror::Error;

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

    #[error("Trash Error: {0}")]
    TrashError(String),
}

pub type CommandResult<T> = Result<T, CommandError>;

impl From<std::io::Error> for CommandError {
    fn from(e: std::io::Error) -> Self {
        CommandError::Io(e.to_string())
    }
}

impl From<reqwest::Error> for CommandError {
    fn from(e: reqwest::Error) -> Self {
        CommandError::Network(e.to_string())
    }
}

impl From<zip::result::ZipError> for CommandError {
    fn from(e: zip::result::ZipError) -> Self {
        CommandError::Zip(e.to_string())
    }
}

impl From<tokio::task::JoinError> for CommandError {
    fn from(e: tokio::task::JoinError) -> Self {
        CommandError::TaskJoin(e.to_string())
    }
}

impl From<trash::Error> for CommandError {
    fn from(e: trash::Error) -> Self {
        CommandError::TrashError(e.to_string())
    }
}

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use tokio::sync::mpsc::Sender;

/// Commands sent into the watcher loop:
#[derive(Debug)]
pub enum WatcherCommand {
    AddPath(PathBuf),
    RemovePath(PathBuf),
    ReplaceMapsPath(Option<PathBuf>, PathBuf),
    Shutdown,
}

/// Shared state for your watcher task:
pub struct WatcherState {
    pub watched_paths: Mutex<HashSet<PathBuf>>,
    pub update_tx: Sender<WatcherCommand>,
}

impl Drop for WatcherState {
    fn drop(&mut self) {
        // We'll fire-and-forget the shutdown command;
        // the watcher loop will see it and break out.
        let _ = self.update_tx.clone().try_send(WatcherCommand::Shutdown);
    }
}

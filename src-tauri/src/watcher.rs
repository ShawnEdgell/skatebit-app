use crate::error::{CommandError, CommandResult};
use crate::{WatcherCommand, WatcherState};
use notify::{event::ModifyKind, Event, EventKind, RecursiveMode, Watcher, Error as NotifyError};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::Duration;
// Import async_runtime from tauri
use tauri::{command, async_runtime, AppHandle, Emitter,State};
use tokio::sync::mpsc;
use tokio::time::Instant;


#[derive(Clone, serde::Serialize)]
struct FsChangeEvent { path: String, kind: String }

// --- Commands remain the same ---
#[command]
pub async fn add_watched_path(path: String, state: State<'_, WatcherState>) -> CommandResult<()> {
    let path_buf = PathBuf::from(&path);
    { let mut paths = state.watched_paths.lock().unwrap(); paths.insert(path_buf.clone()); }
    state.update_tx.send(crate::WatcherCommand::AddPath(path_buf)).await
        .map_err(|e| CommandError::Io(format!("Watcher task comm failed (AddPath): {}", e)))?;
    Ok(())
}

#[command]
pub async fn remove_watched_path(path: String, state: State<'_, WatcherState>) -> CommandResult<()> {
    let path_buf = PathBuf::from(&path);
    { let mut paths = state.watched_paths.lock().unwrap(); paths.remove(&path_buf); }
    state.update_tx.send(crate::WatcherCommand::RemovePath(path_buf)).await
        .map_err(|e| CommandError::Io(format!("Watcher task comm failed (RemovePath): {}", e)))?;
    Ok(())
}

#[command]
pub async fn update_maps_watched_path( old_path_opt: Option<String>, new_path: String, state: State<'_, WatcherState> ) -> CommandResult<()> {
    let old_path_buf = old_path_opt.map(PathBuf::from);
    let new_path_buf = PathBuf::from(&new_path);
    {
        let mut paths = state.watched_paths.lock().unwrap();
        if let Some(ref old) = old_path_buf { paths.remove(old); }
        paths.insert(new_path_buf.clone());
    }
    state.update_tx.send(crate::WatcherCommand::ReplaceMapsPath(old_path_buf, new_path_buf)).await
        .map_err(|e| CommandError::Io(format!("Watcher task comm failed (ReplaceMapsPath): {}", e)))?;
    Ok(())
}


// --- Watcher Task Logic ---
pub fn run_watcher(app_handle: AppHandle, mut update_rx: mpsc::Receiver<crate::WatcherCommand>) {
    // *** FIX: Use tauri::async_runtime::spawn instead of tokio::spawn ***
    async_runtime::spawn(async move {
        let (event_tx, mut event_rx) = mpsc::channel::<Result<Event, NotifyError>>(100);

        let mut watcher = match notify::recommended_watcher(move |res| { let _ = event_tx.try_send(res); }) {
            Ok(w) => w,
            Err(_e) => { /* log error */ return; } // Handle error, maybe emit to frontend?
        };

        let mut currently_watched_by_notify: HashSet<PathBuf> = HashSet::new();
        let mut debounced_changes: HashMap<PathBuf, String> = HashMap::new();
        let mut last_event_time = Instant::now();
        let debounce_duration = Duration::from_millis(500);

        // Removed Log: info!("Watcher Task Started.");

        loop {
            tokio::select! {
                // Biased select ensures commands are processed before potentially large batches of file events
                biased;

                // --- Process Commands ---
                Some(command) = update_rx.recv() => {
                    // Removed Log: debug!("[Watcher Task] Processing command: {:?}", command);
                    match command {
                         WatcherCommand::AddPath(ref path) => {
                            if path.exists() && currently_watched_by_notify.insert(path.clone()) {
                                 if let Err(_e) = watcher.watch(path, RecursiveMode::Recursive) { currently_watched_by_notify.remove(path); }
                            }
                         },
                         WatcherCommand::RemovePath(ref path) => {
                              if currently_watched_by_notify.remove(path) {
                                  let _ = watcher.unwatch(path); // Ignore unwatch error?
                              }
                         },
                          WatcherCommand::ReplaceMapsPath(ref old_path_opt, ref new_path) => {
                              if let Some(old_path) = old_path_opt {
                                  if currently_watched_by_notify.remove(old_path) {
                                       let _ = watcher.unwatch(old_path); // Ignore unwatch error?
                                  }
                              }
                              if new_path.exists() && currently_watched_by_notify.insert(new_path.clone()) {
                                   if let Err(_e) = watcher.watch(new_path, RecursiveMode::Recursive) { currently_watched_by_notify.remove(new_path); }
                              }
                          },
                         WatcherCommand::Shutdown => { break; }
                    }
                },

                // --- Process File Events ---
                Some(event_res) = event_rx.recv() => {
                    if let Ok(event) = event_res {
                        let relevant_kind_str = match event.kind {
                            EventKind::Create(_) => Some("create"),
                            EventKind::Remove(_) => Some("delete"),
                            EventKind::Modify(ModifyKind::Name(_)) => Some("rename"),
                            _ => None,
                        };
                        if let Some(kind) = relevant_kind_str {
                            for path in event.paths {
                                debounced_changes.insert(path, kind.to_string());
                                last_event_time = Instant::now();
                            }
                        }
                    } // Silently ignore Err from notify callback
                },

                // --- Emit Debounced Events ---
                 _ = tokio::time::sleep_until(last_event_time + debounce_duration), if !debounced_changes.is_empty() => {
                    if Instant::now() >= last_event_time + debounce_duration {
                        let events_to_emit: Vec<_> = debounced_changes.drain().collect();
                        for (path, kind) in events_to_emit {
                            if let Some(path_str) = path.to_str() {
                                let payload = FsChangeEvent { path: path_str.to_string().replace("\\", "/"), kind };
                                let _ = app_handle.emit("rust-fs-change", &payload) // Use emit, ignore error for now
                                          .map_err(|e| eprintln!("[Watcher Task] Failed emit rust-fs-change: {}", e));
                            }
                        }
                    }
                },

                 // Break if command channel closes (e.g., sender is dropped)
                 else => break,
            }
        }
        // Removed Log: info!("Watcher Task Exiting.");
    });
}
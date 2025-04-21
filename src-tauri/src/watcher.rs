// src-tauri/src/watcher.rs

use crate::error::{CommandError, CommandResult};
use crate::state::WatcherCommand;

use notify::{
  event::ModifyKind,
  EventKind,
  RecommendedWatcher,
  RecursiveMode,
};
use notify::Watcher as NotifyWatcher; 

use std::{
  collections::{HashMap, HashSet},
  path::PathBuf,
  time::Duration,
};

use tauri::{command, AppHandle, State, Emitter};
use tokio::{sync::mpsc::Receiver, time::Instant};
use tauri::async_runtime;

#[derive(Clone, serde::Serialize)]
pub struct FsChangeEvent {
  pub path: String,
  pub kind: String,
}

#[command]
pub async fn add_watched_path(
  path: String,
  state: State<'_, crate::state::WatcherState>,
) -> CommandResult<()> {
  let pb = PathBuf::from(&path);
  {
    let mut set = state.watched_paths.lock().unwrap();
    set.insert(pb.clone());
  }
  state
    .update_tx
    .send(WatcherCommand::AddPath(pb))
    .await
    .map_err(|e| CommandError::Io(format!("Watcher send(AddPath) failed: {}", e)))?;
  Ok(())
}

#[command]
pub async fn remove_watched_path(
  path: String,
  state: State<'_, crate::state::WatcherState>,
) -> CommandResult<()> {
  let pb = PathBuf::from(&path);
  {
    let mut set = state.watched_paths.lock().unwrap();
    set.remove(&pb);
  }
  state
    .update_tx
    .send(WatcherCommand::RemovePath(pb))
    .await
    .map_err(|e| CommandError::Io(format!("Watcher send(RemovePath) failed: {}", e)))?;
  Ok(())
}

#[command]
pub async fn update_maps_watched_path(
  old_path: Option<String>,
  new_path: String,
  state: State<'_, crate::state::WatcherState>,
) -> CommandResult<()> {
  let old_pb = old_path.map(PathBuf::from);
  let new_pb = PathBuf::from(&new_path);
  {
    let mut set = state.watched_paths.lock().unwrap();
    if let Some(ref o) = old_pb {
      set.remove(o);
    }
    set.insert(new_pb.clone());
  }
  state
    .update_tx
    .send(WatcherCommand::ReplaceMapsPath(old_pb, new_pb))
    .await
    .map_err(|e| CommandError::Io(format!("Watcher send(Replace) failed: {}", e)))?;
  Ok(())
}

/// Spawn the notify loop; debounced FS changes get emitted as `"rust-fs-change"`.
pub fn run_watcher(app: AppHandle, mut rx: Receiver<WatcherCommand>) {
  async_runtime::spawn(async move {
    
    let (raw_tx, mut raw_rx) = tokio::sync::mpsc::channel(100);

    let mut watcher: RecommendedWatcher =
      notify::recommended_watcher(move |res| {
        let _ = raw_tx.try_send(res);
      })
      .expect("failed to create watcher");

    let mut watched = HashSet::new();
    let mut debounce = HashMap::new();
    let mut last = Instant::now();
    let dur = Duration::from_millis(500);

    loop {
      tokio::select! {
        // control commands
        Some(cmd) = rx.recv() => match cmd {
          WatcherCommand::AddPath(p) => {
            if p.exists() && watched.insert(p.clone()) {
              let _ = watcher.watch(&p, RecursiveMode::Recursive);
            }
          }
          WatcherCommand::RemovePath(p) => {
            if watched.remove(&p) {
              let _ = watcher.unwatch(&p);
            }
          }
          WatcherCommand::ReplaceMapsPath(old, newp) => {
            if let Some(o) = old {
              if watched.remove(&o) {
                let _ = watcher.unwatch(&o);
              }
            }
            if newp.exists() && watched.insert(newp.clone()) {
              let _ = watcher.watch(&newp, RecursiveMode::Recursive);
            }
          }
          WatcherCommand::Shutdown => break,
        },

        // raw FS events
        Some(Ok(event)) = raw_rx.recv() => {
          if let Some(kind) = match event.kind {
            EventKind::Create(_) => Some("create"),
            EventKind::Remove(_) => Some("delete"),
            EventKind::Modify(ModifyKind::Name(_)) => Some("rename"),
            _ => None,
          } {
            for p in event.paths {
              debounce.insert(p, kind.to_string());
              last = Instant::now();
            }
          }
        }

        // debounce timer
        _ = tokio::time::sleep_until(last + dur), if !debounce.is_empty() => {
          if Instant::now() >= last + dur {
            let to_emit: Vec<_> = debounce.drain().collect();
            for (p, kind) in to_emit {
              if let Some(s) = p.to_str() {
                let evt = FsChangeEvent { path: s.replace("\\", "/"), kind };
                // broadcast to all windows:
                if let Err(e) = app.emit("rust-fs-change", evt) {
                  eprintln!("[Watcher] emit_all failed: {}", e);
                }
              }
            }
          }
        }
      }
    }
  });
}

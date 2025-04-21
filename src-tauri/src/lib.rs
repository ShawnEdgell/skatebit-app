// src-tauri/src/lib.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod error;
mod fs_commands;
mod installer_commands;
mod map_commands;
mod models;
mod state;
mod utils;
mod watcher;

use std::{collections::HashSet, sync::Mutex};
use tokio::sync::mpsc::channel;

use state::{WatcherCommand, WatcherState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info"),
    )
    .init();
    log::info!("Starting application…");

    let (tx, rx) = channel::<WatcherCommand>(100);

    let watcher_state = WatcherState {
        watched_paths: Mutex::new(HashSet::new()),
        update_tx: tx.clone(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        
        .manage(watcher_state)

        .invoke_handler(tauri::generate_handler![
            // FS commands
            fs_commands::handle_dropped_zip,
            fs_commands::save_file,
            fs_commands::list_directory_entries,
            fs_commands::create_directory_rust,
            fs_commands::create_empty_file_rust,
            fs_commands::rename_fs_entry_rust,
            fs_commands::delete_fs_entry_rust,
            // Map commands
            map_commands::is_symlink,
            map_commands::create_maps_symlink,
            map_commands::remove_maps_symlink,
            map_commands::list_local_maps,
            // Installer commands
            installer_commands::download_and_install,
            // Watcher commands
            watcher::add_watched_path,
            watcher::remove_watched_path,
            watcher::update_maps_watched_path,
        ])

        .setup(move |app| {
            watcher::run_watcher(app.handle().clone(), rx);
            Ok(())
        })

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

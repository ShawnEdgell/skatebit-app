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

use tauri::{
    Builder,
    Manager,     // Keep Manager trait in scope for get_webview_window
    WindowEvent, // Keep WindowEvent for pattern matching
                 // Remove GlobalWindowEvent import
};
use tauri::menu::{MenuBuilder, MenuId};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_single_instance::init as single_instance_init;

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

    Builder::default()
        .plugin(single_instance_init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show().and_then(|_| w.set_focus());
            }
        }))
        // Revised on_window_event handler
        .on_window_event(|handle, event| { // Use handle and event
            // Match directly on the WindowEvent enum
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Use the handle to get the specific window ('main')
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.hide(); // Call hide on the retrieved window
                }
                api.prevent_close(); // Prevent default close
            }
        })
            .setup(move |app| {
    // start your file watcher
    watcher::run_watcher(app.handle().clone(), rx);

    // build the tray menu
    let tray_menu = MenuBuilder::new(app.handle())
        .text(MenuId::new("show"), "Show XLFM")
        .text(MenuId::new("quit"), "Quit")
        .build()?;

    // grab the same icon you shipped under `icons/` in tauri.conf.json
    let icon = app
        .default_window_icon()                // returns Option<Icon>
        .expect("default icon not configured")
        .clone();

    // build the tray with that icon
    TrayIconBuilder::new()
        .icon(icon)
        .menu(&tray_menu)
        .on_menu_event(|app_handle, event| {
            if event.id == "show" {
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.show().and_then(|_| w.set_focus());
                }
            } else if event.id == "quit" {
                std::process::exit(0);
            }
        })
        .build(app)?;        

    Ok(())
})

        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(watcher_state)
        .invoke_handler(tauri::generate_handler![
            fs_commands::handle_dropped_zip,
            fs_commands::save_file,
            fs_commands::list_directory_entries,
            fs_commands::create_directory_rust,
            fs_commands::create_empty_file_rust,
            fs_commands::rename_fs_entry_rust,
            fs_commands::delete_fs_entry_rust,
            map_commands::is_symlink,
            map_commands::create_maps_symlink,
            map_commands::remove_maps_symlink,
            map_commands::list_local_maps,
            installer_commands::download_and_install,
            watcher::add_watched_path,
            watcher::remove_watched_path,
            watcher::update_maps_watched_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
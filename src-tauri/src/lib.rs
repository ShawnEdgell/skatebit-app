mod error;
mod fs_commands;
mod installer_commands;
mod map_commands;
mod models;
mod state;
mod utils;
mod watcher;
mod path_finder;
mod mod_commands;

use std::{collections::HashSet, sync::Mutex};
use tokio::sync::mpsc::channel;
use tauri::{
    Builder,
    Manager,
    WindowEvent,
    menu::{MenuBuilder, MenuId},
    tray::TrayIconBuilder,
    RunEvent,
    Listener,
};
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

    let tauri_app = Builder::default()
        .plugin(single_instance_init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show().and_then(|_| w.set_focus());
            }
        }))
        .on_window_event(|handle, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.hide();
                }
                api.prevent_close();
            }
        })
        .setup(move |app| {
            watcher::run_watcher(app.handle().clone(), rx);

            let tray_menu = MenuBuilder::new(app.handle())
                .text(MenuId::new("show"), "Show XLFM")
                .text(MenuId::new("quit"), "Quit")
                .build()?;

            let icon = app
                .default_window_icon()
                .expect("default icon not configured")
                .clone();

            TrayIconBuilder::new()
                .icon(icon)
                .menu(&tray_menu)
                .on_menu_event(|app_handle, event| {
                    if event.id == "show" {
                        if let Some(w) = app_handle.get_webview_window("main") {
                            let _ = w.show().and_then(|_| w.set_focus());
                        }
                    } else if event.id == "quit" {
                        app_handle.exit(0);
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
        // This line is required and has been added back in.
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
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
            mod_commands::list_local_mods,
            installer_commands::download_and_install,
            watcher::add_watched_path,
            watcher::remove_watched_path,
            watcher::update_maps_watched_path,
            path_finder::find_skaterxl_user_data_path
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    #[cfg(not(mobile))]
    tauri_app.listen("deep-link-received", move |event| {
        let payload_str = event.payload();
        log::info!("Deep link payload received: {}", payload_str);
        if let Ok(url) = serde_json::from_str::<String>(payload_str) {
            log::info!("Successfully parsed deep link URL: {}", url);
        } else {
            log::error!("Failed to parse deep link payload as a JSON string: {}", payload_str);
        }
    });

    tauri_app.run(|_app_handle, event| {
        if let RunEvent::ExitRequested { api, .. } = event {
            api.prevent_exit();
        }
    });
}

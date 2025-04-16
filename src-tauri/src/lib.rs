// src-tauri/src/lib.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod utils;
mod error;
mod fs_commands;
mod map_commands;
mod installer_commands;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging - good practice
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    log::info!("Logger initialized, starting application build...");

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            fs_commands::handle_dropped_zip, 
            fs_commands::save_file,
            fs_commands::list_directory_entries,
            fs_commands::create_directory_rust,
            fs_commands::create_empty_file_rust,
            fs_commands::rename_fs_entry_rust,
            fs_commands::delete_fs_entry_rust,
            // Map Commands
            map_commands::create_maps_symlink,
            map_commands::remove_maps_symlink,
            map_commands::list_local_maps,
            // Installer Commands
            installer_commands::download_and_install,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
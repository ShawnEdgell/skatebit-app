// src-tauri/src/lib.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands; // Ensure this line exists

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            // Existing commands
            commands::unzip_file,
            commands::save_file,
            commands::download_and_install,
            // --- Add NEW commands ---
            commands::list_local_maps,
            commands::list_directory_entries,
            commands::create_directory_rust,
            commands::create_empty_file_rust,
            commands::rename_fs_entry_rust,
            commands::delete_fs_entry_rust
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

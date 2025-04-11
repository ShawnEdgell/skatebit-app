#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

#[tauri::command]
fn greet(name: &str) -> String {
  format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::unzip_file,
            commands::save_file,
            commands::download_and_install
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use std::fs;
use std::path::PathBuf;
use regex::Regex;

/// Attempts to find Skater XL install path by scanning Steam library folders.
#[tauri::command]
pub fn find_skaterxl_path() -> Option<String> {
    let steam_vdf = dirs::home_dir()?.join("AppData/Local/Steam/config/libraryfolders.vdf");
    let content = fs::read_to_string(&steam_vdf).ok()?;

    let re = Regex::new(r#""\d+"\s+"([^"]+)""#).ok()?;
    for cap in re.captures_iter(&content) {
        let lib_path = cap.get(1)?.as_str().replace("\\\\", "\\");
        let candidate = PathBuf::from(&lib_path)
            .join("steamapps")
            .join("common")
            .join("Skater XL");
        if candidate.exists() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }

    None
}

const SKATER_XL_APP_ID: u32 = 962730;

/// Finds the Skater XL user data directory.
/// This function is platform-agnostic and handles three cases:
/// 1. Native Windows installations.
/// 2. Linux installations via Steam Play (Proton).
/// 3. Native macOS (returns None as the game is not supported).
#[tauri::command]
pub fn find_skaterxl_user_data_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        // On Windows, the path is straightforward: %USERPROFILE%\Documents\SkaterXL
        // We use the `dirs` crate to find the user's document directory reliably.
        let docs_path = match dirs::document_dir() {
            Some(path) => path,
            None => return None, // Cannot find Documents folder
        };

        let candidate = docs_path.join("SkaterXL");

        if candidate.exists() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, the game runs through Proton, so we must find the "compatdata" directory.
        // The `steamlocate` crate reliably finds all Steam library folders.

        if let Ok(steamdir) = steamlocate::SteamDir::locate() {
            println!("[LOG] SteamDir located successfully: {:?}", steamdir.path());

            // 1. Check the main Steam directory first
            let main_steam_candidate = steamdir.path()
                .join("steamapps")
                .join("compatdata")
                .join(SKATER_XL_APP_ID.to_string())
                .join("pfx")
                .join("drive_c")
                .join("users")
                .join("steamuser")
                .join("Documents")
                .join("SkaterXL");

            println!("[LOG] Constructed candidate path (main SteamDir): {:?}", &main_steam_candidate);
            if main_steam_candidate.exists() {
                println!("[LOG] Found Linux (Proton) user data path at (main SteamDir): {:?}", &main_steam_candidate);
                return Some(main_steam_candidate.to_string_lossy().into_owned());
            } else {
                println!("[LOG] Candidate path (main SteamDir) does not exist: {:?}", &main_steam_candidate);
            }

            // 2. If not found in main, check additional Steam libraries
            if let Ok(libraries) = steamdir.libraries() {
                println!("[LOG] Found {} additional Steam libraries.", libraries.len());
                for library_result in libraries {
                    if let Ok(library) = library_result {
                        println!("[LOG] Checking additional Steam library path: {:?}", library.path());
                        let library_candidate = library.path()
                            .join("steamapps")
                            .join("compatdata")
                            .join(SKATER_XL_APP_ID.to_string())
                            .join("pfx")
                            .join("drive_c")
                            .join("users")
                            .join("steamuser")
                            .join("Documents")
                            .join("SkaterXL");

                        println!("[LOG] Constructed candidate path (additional library): {:?}", &library_candidate);

                        if library_candidate.exists() {
                            println!("[LOG] Found Linux (Proton) user data path at (additional library): {:?}", &library_candidate);
                            return Some(library_candidate.to_string_lossy().into_owned());
                        } else {
                            println!("[LOG] Candidate path (additional library) does not exist: {:?}", &library_candidate);
                        }
                    } else {
                        println!("[LOG] Failed to get Steam library path from result.");
                    }
                }
            } else {
                println!("[LOG] Failed to get additional Steam libraries.");
            }
        } else {
            println!("[LOG] Failed to locate Steam directory via steamlocate.");
        }

        // 3. Fallback: Check common Steam path directly if steamlocate fails or doesn't find it
        if let Some(home_dir) = dirs::home_dir() {
            let common_steam_path = home_dir.join(".steam")
                                            .join("steam")
                                            .join("steamapps")
                                            .join("compatdata")
                                            .join(SKATER_XL_APP_ID.to_string())
                                            .join("pfx")
                                            .join("drive_c")
                                            .join("users")
                                            .join("steamuser")
                                            .join("Documents")
                                            .join("Skater XL");

            println!("[LOG] Constructed candidate path (fallback): {:?}", &common_steam_path);

            if common_steam_path.exists() {
                println!("[LOG] Found Linux (Proton) user data path at (fallback): {:?}", &common_steam_path);
                return Some(common_steam_path.to_string_lossy().into_owned());
            } else {
                println!("[LOG] Candidate path (fallback) does not exist: {:?}", &common_steam_path);
            }
        }
    }

    // Skater XL is not available on macOS, and this is a fallback for other systems
    // or if the path was not found in any of the checks above.
    None
}
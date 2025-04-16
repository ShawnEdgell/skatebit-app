//! Contains Tauri commands for downloading and installing files/archives.

use std::{env, fs};
use tauri::{command, AppHandle, Emitter};
use tokio::task; // Make sure `tokio = { version = "1", features = ["rt-multi-thread", "macros"] }` is in Cargo.toml
use uuid::Uuid;

// Import commands from other modules, utilities, and error types
use crate::fs_commands::{save_file, unzip_file}; // Corrected import path
use crate::utils::resolve_document_path;
use crate::error::{CommandError, CommandResult};


#[command(async)] // Ensure command is marked async
pub async fn download_and_install(
    url: String,
    destination_subfolder: String,
    app_handle: AppHandle,
) -> CommandResult<()> {
    println!(
        "[installer::download_and_install] Downloading {} to subfolder '{}'",
        url, destination_subfolder
    );

    // Resolve destination path using utility function
    let full_destination_path = resolve_document_path(&destination_subfolder)
        .map_err(CommandError::DirectoryResolution)?;

    println!(
        "[installer::download_and_install] Resolved destination path: {}",
        full_destination_path.display()
    );

    // Create destination directory if it doesn't exist
    fs::create_dir_all(&full_destination_path).map_err(|e| {
        CommandError::Io(format!(
            "Failed create destination dir {:?}: {}",
            full_destination_path.display(),
            e
        ))
    })?;

    // Perform the download
    // Handle reqwest errors using map_err or From trait if implemented
    let response = reqwest::get(&url)
        .await
        .map_err(|e| CommandError::Network(format!("Download request failed for {}: {}", url, e)))?;

    if !response.status().is_success() {
        return Err(CommandError::Download {
            status_code: response.status().as_u16(),
            message: format!("Download failed with status {}", response.status()),
        });
    }

    // Keep headers for potential filename extraction
    let headers = response.headers().clone();

    // Read response body bytes
    // Handle reqwest body reading errors
    let bytes = response
        .bytes()
        .await
        .map_err(|e| CommandError::Network(format!("Failed read response bytes: {}", e)))?;

    // Check if the downloaded content looks like a zip file (basic check)
    let is_zip = bytes.len() >= 4 && bytes.starts_with(b"PK\x03\x04");

    if is_zip {
        println!("[installer::download_and_install] Downloaded file appears to be a ZIP.");
        // Create a temporary file path for the zip
        let tmp_file_path = env::temp_dir().join(format!("downloaded_{}.zip", Uuid::new_v4()));
        println!(
            "[installer::download_and_install] Writing temporary zip to: {}",
            tmp_file_path.display()
        );

        // Write downloaded bytes to the temporary file
        fs::write(&tmp_file_path, &bytes).map_err(|e| {
            CommandError::Io(format!(
                "Error writing temporary zip {}: {}",
                tmp_file_path.display(),
                e
            ))
        })?;

        let zip_path_str = tmp_file_path.to_string_lossy().to_string();
        let dest_path_str = full_destination_path.to_string_lossy().to_string();
        let app_handle_clone = app_handle.clone(); // Clone AppHandle for the blocking task

        // Run the potentially long-running unzip operation in a blocking thread
        println!("[installer::download_and_install] Spawning blocking task for unzip...");
        let unzip_result = task::spawn_blocking(move || {
            // Call unzip_file from the fs_commands module
           unzip_file(zip_path_str, dest_path_str)
    .map_err(|e| CommandError::Operation(e))
        })
        .await
        .map_err(|e| CommandError::TaskJoin(format!("Unzip task panicked or failed: {}", e)))?; // Handle JoinError, mapping to CommandError

        // Emit event regardless of unzip result? Or only on success? Let's emit on success.
        if unzip_result.is_ok() {
            println!("[installer::download_and_install] Unzip successful, emitting maps-changed.");
            // Emit event to frontend indicating changes
            let _ = app_handle_clone.emit("maps-changed", "changed");
        } else {
            eprintln!("[installer::download_and_install] Unzip failed: {:?}", unzip_result.as_ref().err());
        }
        unzip_result?; // Propagate error from unzip_file if it failed

        println!("[installer::download_and_install] Blocking unzip task finished.");
    } else {
        // Downloaded file is not a zip, save it directly
        println!("[installer::download_and_install] Downloaded file is not a zip. Saving directly.");
        // Try to extract filename from headers, otherwise guess from URL
        let filename = headers
            .get("content-disposition")
            .and_then(|v| v.to_str().ok())
            .and_then(|c| c.split("filename=").nth(1))
            .map(|s| s.trim_matches('"').to_string())
            .filter(|s| !s.is_empty()) // Ensure filename is not empty
            .unwrap_or_else(|| {
                url.split('/')
                    .last()
                    .filter(|s| !s.is_empty()) // Ensure segment is not empty
                    .unwrap_or("downloaded_file") // Fallback filename
                    .to_string()
            });

        let target_file_path = full_destination_path.join(&filename);
        println!(
            "[installer::download_and_install] Saving non-zip file to: {}",
            target_file_path.display()
        );

        // Call save_file from fs_commands module
        // The save_file function already returns CommandResult<()>
       let save_result = save_file(
    target_file_path.to_string_lossy().to_string(),
    bytes.to_vec(),
).map_err(|e| CommandError::Operation(e));

        if save_result.is_ok() {
            println!("[installer::download_and_install] Save successful, emitting maps-changed.");
            // Emit event to frontend indicating changes
            let _ = app_handle.emit("maps-changed", "changed");
        } else {
            eprintln!("[installer::download_and_install] Save failed: {:?}", save_result.as_ref().err());
        }
        save_result?; // Propagate error if save_file failed
    }

    println!("[installer::download_and_install] Download and install process completed successfully.");
    Ok(())
}
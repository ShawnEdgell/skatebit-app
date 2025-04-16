use crate::error::{CommandError, CommandResult};
use crate::models::{InstallationProgress, InstallationResult};
use crate::fs_commands;
use crate::utils::resolve_document_path;

use std::{
    fs::{self, File},
    io::Write,
};
use tauri::{command, AppHandle, Manager, Emitter};
use tokio::task;
use uuid::Uuid;
use log;
use reqwest;

fn emit_progress(app_handle: &AppHandle, step: &str, progress: f64, message: String, source: &str) {
    if let Err(e) = app_handle.emit("installation_progress", InstallationProgress {
        step: step.to_string(),
        progress,
        message,
        source: source.to_string(),
     }) {
        log::warn!("[installer::emit_progress] Failed emit event: {}", e);
    }
}

#[command(async)]
pub async fn download_and_install(
    app_handle: AppHandle,
    url: String,
    destination_subfolder: String,
) -> CommandResult<InstallationResult> {
    let original_source = url.clone();
    log::info!("[installer::download_and_install] Start: URL='{}', Subfolder='{}'", original_source, destination_subfolder);
    let start_time = std::time::Instant::now();

    let full_destination_path = resolve_document_path(&destination_subfolder).map_err(CommandError::DirectoryResolution)?;
    log::info!("[installer::download_and_install] Resolved Dest Path: {}", full_destination_path.display());

    if !full_destination_path.exists() {
        fs::create_dir_all(&full_destination_path).map_err(|e| CommandError::Io(format!("Failed create dest dir {}: {}", full_destination_path.display(), e)))?;
        log::info!("[installer::download_and_install] Created dest dir: {}", full_destination_path.display());
    } else if !full_destination_path.is_dir() {
        return Err(CommandError::Input(format!("Dest path exists but is not a dir: {}", full_destination_path.display())));
    }

    emit_progress(&app_handle, "downloading", 0.0, "Starting download...".to_string(), &original_source);
    let temp_dir = app_handle.path().app_cache_dir().or_else(|_| app_handle.path().temp_dir()).map_err(|e| CommandError::Io(format!("Failed get app cache/temp dir: {}", e)))?;
    fs::create_dir_all(&temp_dir).map_err(|e| CommandError::Io(format!("Failed create temp dir {:?}: {}", temp_dir, e)))?;
    let temp_filename = format!("download_{}.tmp", Uuid::new_v4());
    let temp_download_path = temp_dir.join(&temp_filename);
    log::info!("[installer::download_and_install] Downloading to Temp: {}", temp_download_path.display());

    let client = reqwest::Client::new();
    // Hold onto the response variable to access headers *after* status check if needed
    let mut response = client.get(&url).send().await.map_err(|e| CommandError::Network(format!("Download request failed: {}", e)))?;

    // --- Check HTTP Status ---
    if !response.status().is_success() { // Brace opened here
        let status = response.status();
        let error_msg = format!("Download failed: Status {}", status);
        log::error!("[installer::download_and_install] {}", error_msg);
        emit_progress(&app_handle, "error", 0.0, error_msg.clone(), &original_source);
        let _ = fs::remove_file(&temp_download_path);

        return Err(CommandError::Download {
            status_code: status.as_u16(),
            message: error_msg,
        });
    } // <--- ADD THE MISSING CLOSING BRACE HERE

    // --- Continue ONLY if status was successful ---
    let headers = response.headers().clone(); // Clone headers now that we know status is OK
    let total_size = response.content_length();
    let mut file = File::create(&temp_download_path).map_err(|e| CommandError::Io(format!("Failed create temp file {:?}: {}", temp_download_path, e)))?;
    let mut downloaded: u64 = 0;
    let mut last_emitted_progress: f64 = -1.0;

    while let Some(chunk) = response.chunk().await.map_err(|e| CommandError::Network(format!("Err reading download chunk: {}", e)))? {
        file.write_all(&chunk).map_err(|e| CommandError::Io(format!("Failed write chunk to temp file {:?}: {}", temp_download_path, e)))?;
        downloaded += chunk.len() as u64;
        if let Some(total) = total_size { if total > 0 { let progress = (downloaded as f64 / total as f64).clamp(0.0, 1.0); if (progress * 100.0).round() > (last_emitted_progress * 100.0).round() || progress == 1.0 { emit_progress(&app_handle, "downloading", progress, format!("Downloading... {:.0}%", progress * 100.0), &original_source); last_emitted_progress = progress; } } else { if last_emitted_progress < 0.0 { emit_progress(&app_handle, "downloading", 0.0, "Downloading... (size 0)".to_string(), &original_source); last_emitted_progress = 0.0;} } }
        else { if downloaded % (1024 * 1024) == 0 || last_emitted_progress < 0.0 { emit_progress(&app_handle, "downloading", 0.0, format!("Downloading... {} bytes", downloaded), &original_source); last_emitted_progress = 0.0; } }
    }
    drop(file);
    log::info!("[installer::download_and_install] Download complete: {}", temp_download_path.display());
    emit_progress(&app_handle, "downloading", 1.0, "Download complete.".to_string(), &original_source);

    let is_zip = { let mut f = File::open(&temp_download_path).map_err(|e| CommandError::Io(format!("Failed check temp file type {:?}: {}", temp_download_path, e)))?; let mut buffer = [0u8; 4]; use std::io::Read; f.read_exact(&mut buffer).is_ok() && buffer == *b"PK\x03\x04" };

    let final_result: CommandResult<InstallationResult>;

    if is_zip {
        log::info!("[installer::download_and_install] Processing as ZIP.");
        emit_progress(&app_handle, "extracting", 0.0, "Starting extraction...".to_string(), &original_source);
        let zip_path_str = temp_download_path.to_string_lossy().to_string();
        let dest_path_str = full_destination_path.to_string_lossy().to_string();

        let unzip_task_result = task::spawn_blocking(move || {
            fs_commands::unzip_file_internal(&zip_path_str, &dest_path_str, true)
        }).await.map_err(|e| CommandError::TaskJoin(format!("Unzip task panicked: {}", e)))?;

        match unzip_task_result {
            Ok(final_path) => {
                let duration = start_time.elapsed();
                let success_msg = format!("Installation successful ({:.2?}s)", duration);
                log::info!("[installer::download_and_install] {}", success_msg);
                emit_progress(&app_handle, "complete", 1.0, success_msg.clone(), &original_source);
                let _ = app_handle.emit("maps-changed", ());
                final_result = Ok(InstallationResult { success: true, message: success_msg, final_path: Some(final_path), source: original_source });
            }
            Err(e) => {
                log::error!("[installer::download_and_install] Unzip failed: {:?}", e);
                let error_msg = format!("Extraction failed: {:?}", e);
                emit_progress(&app_handle, "error", 0.0, error_msg, &original_source);
                log::warn!("[installer::download_and_install] Leaving temp file due to error: {}", temp_download_path.display());
                final_result = Err(e);
            }
        }
    } else {
        log::info!("[installer::download_and_install] Processing as direct save (non-ZIP).");
        // Use response_stream URL info which might still be available if needed,
        // or fallback to original_source URL. Using original_source is safer.
        let filename = url.split('/').last().filter(|s| !s.is_empty()) // Use original URL
            .or_else(|| headers.get("content-disposition") // Then try content-disposition header
                .and_then(|v| v.to_str().ok())
                .and_then(|cd| cd.split(';').find(|p| p.trim().starts_with("filename=")))
                .and_then(|fp| fp.split('=').nth(1))
                .map(|name| name.trim_matches('"').trim())
                .filter(|name| !name.is_empty())
            )
            .map(String::from)
            .unwrap_or_else(|| "downloaded_file".to_string()); // Fallback

        let target_file_path = full_destination_path.join(&filename);
        log::info!("[installer::download_and_install] Moving temp file to: {}", target_file_path.display());
        emit_progress(&app_handle, "saving", 1.0, "Saving file...".to_string(), &original_source);

        match fs::rename(&temp_download_path, &target_file_path) {
             Ok(_) => {
                 let duration = start_time.elapsed();
                 let success_msg = format!("File saved successfully ({:.2?}s)", duration);
                 log::info!("[installer::download_and_install] {}", success_msg);
                 emit_progress(&app_handle, "complete", 1.0, success_msg.clone(), &original_source);
                 let _ = app_handle.emit("maps-changed", ());
                 final_result = Ok(InstallationResult { success: true, message: success_msg, final_path: Some(target_file_path), source: original_source });
             }
             Err(e) => {
                 log::error!("[installer::download_and_install] Failed move temp file: {}", e);
                 let error_msg = format!("Failed save file: {}", e);
                  emit_progress(&app_handle, "error", 0.0, error_msg.clone(), &original_source);
                 let _ = fs::remove_file(&temp_download_path);
                 final_result = Err(CommandError::Io(error_msg));
             }
        }
    }
    final_result
} 
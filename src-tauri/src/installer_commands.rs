// src-tauri/src/installer_commands.rs

use crate::error::{CommandError, CommandResult};
use crate::models::{InstallationProgress, InstallationResult};
use crate::fs_commands;
use crate::utils::resolve_document_path;

use std::{
    fs::{self, File},
    io::{Read, Write},
};
use tauri::{command, AppHandle, Manager, Emitter};
use tokio::task;
use uuid::Uuid;
use log::{info, warn, error};
use reqwest;

/// Helper to emit installation‐progress events back to the frontend.
fn emit_progress(
    app: &AppHandle,
    step: &str,
    progress: f64,
    message: String,
    source: &str,
) {
    if let Err(e) = app.emit(
        "installation_progress",
        InstallationProgress {
            step: step.to_string(),
            progress,
            message,
            source: source.to_string(),
        },
    ) {
        warn!("[installer::emit_progress] {}", e);
    }
}

#[command]
pub async fn download_and_install(
    app_handle: AppHandle,
    url: String,
    destination_subfolder: String,
) -> CommandResult<InstallationResult> {
    let source_url = url.clone();
    info!(
        "[installer] download_and_install: {} → {}",
        source_url, destination_subfolder
    );
    let start = std::time::Instant::now();

    // Resolve and create destination
    let dest = resolve_document_path(&destination_subfolder)
        .map_err(CommandError::DirectoryResolution)?;
    if !dest.exists() {
        fs::create_dir_all(&dest)
            .map_err(|e| CommandError::Io(e.to_string()))?;
    } else if !dest.is_dir() {
        return Err(CommandError::Input(format!(
            "Destination exists but is not a directory: {}",
            dest.display()
        )));
    }

    // Begin download
    emit_progress(
        &app_handle,
        "downloading",
        0.0_f64,
        "Starting download…".into(),
        &source_url,
    );
    let temp_dir = app_handle
        .path()
        .app_cache_dir()
        .or_else(|_| app_handle.path().temp_dir())
        .map_err(|e| CommandError::Io(e.to_string()))?;
    fs::create_dir_all(&temp_dir).map_err(|e| CommandError::Io(e.to_string()))?;
    let tmp_name = format!("dl_{}.tmp", Uuid::new_v4());
    let tmp_path = temp_dir.join(tmp_name);

    let client = reqwest::Client::new();
    let mut resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| CommandError::Network(e.to_string()))?;

    // Check status
    if !resp.status().is_success() {
        let code = resp.status().as_u16();
        let msg = format!("HTTP {}", resp.status());
        error!("[installer] download failed: {}", msg);
        emit_progress(&app_handle, "error", 0.0_f64, msg.clone(), &source_url);
        let _ = fs::remove_file(&tmp_path);
        return Err(CommandError::Download {
            status_code: code,
            message: msg,
        });
    }

    // Stream to disk with progress
    let total = resp.content_length().unwrap_or(0);
    let mut file = File::create(&tmp_path).map_err(|e| CommandError::Io(e.to_string()))?;
    let mut downloaded = 0u64;
    let mut last_emit = -1.0_f64;
    while let Some(chunk) = resp
        .chunk()
        .await
        .map_err(|e| CommandError::Network(e.to_string()))?
    {
        file.write_all(&chunk)
            .map_err(|e| CommandError::Io(e.to_string()))?;
        downloaded += chunk.len() as u64;

        if total > 0 {
            let prog = (downloaded as f64 / total as f64).clamp(0.0_f64, 1.0_f64);
            if (prog * 100.0_f64).round() > (last_emit * 100.0_f64).round() || prog == 1.0_f64 {
                emit_progress(
                    &app_handle,
                    "downloading",
                    prog,
                    format!("Downloading… {:.0}%", prog * 100.0_f64),
                    &source_url,
                );
                last_emit = prog;
            }
        } else if downloaded % (1024 * 1024) == 0 || last_emit < 0.0_f64 {
            emit_progress(
                &app_handle,
                "downloading",
                0.0_f64,
                format!("Downloaded {} bytes", downloaded),
                &source_url,
            );
            last_emit = 0.0_f64;
        }
    }
    drop(file);
    emit_progress(
        &app_handle,
        "downloading",
        1.0_f64,
        "Download complete.".into(),
        &source_url,
    );

    // Sniff for ZIP magic
    let is_zip = {
        let mut buf = [0u8; 4];
        File::open(&tmp_path)
            .and_then(|mut f| f.read_exact(&mut buf).map(|_| buf))
            .map(|b| b == *b"PK\x03\x04")
            .unwrap_or(false)
    };

    // Extraction vs direct save
    let result = if is_zip {
        emit_progress(
            &app_handle,
            "extracting",
            0.0_f64,
            "Starting extraction…".into(),
            &source_url,
        );
        let tmp_str = tmp_path.to_string_lossy().to_string();
        let dest_str = dest.to_string_lossy().to_string();
        match task::spawn_blocking(move || {
            fs_commands::unzip_file_internal(&tmp_str, &dest_str, true)
        })
        .await
        {
            Err(join_err) => Err(CommandError::TaskJoin(join_err.to_string())),
            Ok(Err(e)) => {
                emit_progress(&app_handle, "error", 0.0_f64, format!("{:?}", e), &source_url);
                Err(e)
            }
            Ok(Ok(final_path)) => {
                let dur = start.elapsed();
                let msg = format!("Installed in {:.2?}", dur);
                emit_progress(&app_handle, "complete", 1.0_f64, msg.clone(), &source_url);
                Ok(InstallationResult {
                    success: true,
                    message: msg,
                    final_path: Some(final_path),
                    source: source_url,
                })
            }
        }
    } else {
        emit_progress(
            &app_handle,
            "saving",
            1.0_f64,
            "Saving file…".into(),
            &source_url,
        );
        let filename = url
            .split('/')
            .last()
            .filter(|s| !s.is_empty())
            .map(String::from)
            .unwrap_or_else(|| "downloaded_file".into());
        let target = dest.join(&filename);
        match fs::rename(&tmp_path, &target) {
            Ok(()) => {
                let dur = start.elapsed();
                let msg = format!("Saved in {:.2?}", dur);
                emit_progress(&app_handle, "complete", 1.0_f64, msg.clone(), &source_url);
                Ok(InstallationResult {
                    success: true,
                    message: msg,
                    final_path: Some(target),
                    source: source_url,
                })
            }
            Err(e) => {
                emit_progress(&app_handle, "error", 0.0_f64, e.to_string(), &source_url);
                Err(CommandError::Io(e.to_string()))
            }
        }
    };

    result
}
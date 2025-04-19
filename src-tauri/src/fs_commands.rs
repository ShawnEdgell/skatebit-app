// src-tauri/src/fs_commands.rs

use crate::error::{CommandError, CommandResult};
use crate::models::{FsEntry, DirectoryListingResult, ListingStatus, InstallationResult};
use crate::utils::{system_time_to_millis, THUMBNAIL_EXTS, hash_path};

use std::{
    collections::HashSet,
    ffi::OsStr,
    fs::{self, File},
    io::{copy, BufReader, BufWriter},
    path::{Path, PathBuf},
};
use tauri::{command, AppHandle, Manager, Emitter};
use uuid::Uuid;
use zip::ZipArchive;
use log::{debug, info, error};
use serde_json;
use trash;

fn map_io_error<S: AsRef<str>>(msg: S, path: &Path, e: std::io::Error) -> CommandError {
    CommandError::Io(format!("{}: {}: {}", msg.as_ref(), path.display(), e))
}

pub fn unzip_file_internal(
    source: &str,
    target_base: &str,
    delete_source_on_success: bool,
) -> CommandResult<PathBuf> {
    info!("unzip: {} → {} (delete? {})", source, target_base, delete_source_on_success);
    let src = PathBuf::from(source);
    let base = PathBuf::from(target_base);

    // 1) Open ZIP for metadata scan
    let meta_file = File::open(&src).map_err(|e| map_io_error("open zip for meta", &src, e))?;
    let mut meta = ZipArchive::new(meta_file)
        .map_err(|e| CommandError::Zip(format!("read zip meta: {}", e)))?;
    let count = meta.len();
    debug!("archive contains {} entries", count);

    // If empty, just create an empty folder named after stem
    if count == 0 {
        let stem = src
            .file_stem()
            .and_then(OsStr::to_str)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| format!("empty_zip_{}", Uuid::new_v4()));
        let out = base.join(&stem);
        fs::create_dir_all(&out).map_err(|e| map_io_error("mkdir empty", &out, e))?;
        return Ok(out);
    }

    // Gather top‑level items and track largest file
    let mut roots = HashSet::new();
    let mut has_root_file = false;
    let mut largest: Option<(u64, PathBuf)> = None;

    for i in 0..count {
        let entry = meta.by_index(i).map_err(|e| CommandError::Zip(format!("{}", e)))?;
        let path = entry.mangled_name();

        if path.components().any(|c| c.as_os_str() == "..") {
            return Err(CommandError::Input(format!("unsafe path {:?}", path)));
        }

        // record top level
        if let Some(first) = path.components().next() {
            let s = first.as_os_str().to_string_lossy().to_string();
            roots.insert(s);
            if path.components().count() == 1 && !entry.is_dir() {
                has_root_file = true;
            }
        }

        // track largest file
        if !entry.is_dir() {
            let sz = entry.size();
            if largest.as_ref().map_or(true, |(prev, _)| sz > *prev) {
                largest = Some((sz, path.clone()));
            }
        }
    }

    // Decide output folder name + stripping
    let (out_base, strip_root) = if roots.len() == 1 && !has_root_file {
        let only = roots.into_iter().next().unwrap();
        (base.join(&only), Some(only))
    } else {
        let name = largest
            .as_ref()
            .and_then(|(_, p)| p.file_stem())
            .and_then(OsStr::to_str)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .or_else(|| {
                src.file_stem()
                    .and_then(OsStr::to_str)
                    .map(str::to_string)
            })
            .unwrap_or_else(|| format!("unzipped_{}", Uuid::new_v4()));
        (base.join(&name), None)
    };

    fs::create_dir_all(&out_base).map_err(|e| map_io_error("mkdir out_base", &out_base, e))?;
    info!("extracting into {:?}", out_base);

    // 2) Re‑open for extraction
    let extract_file = File::open(&src).map_err(|e| map_io_error("open zip for extract", &src, e))?;
    let mut archive = ZipArchive::new(extract_file)
        .map_err(|e| CommandError::Zip(format!("read zip extract: {}", e)))?;

    let mut extracted = 0;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| CommandError::Zip(format!("{}", e)))?;
        let mut out_path = entry.mangled_name();

        // strip single root if any
        if let Some(root) = &strip_root {
            if out_path.starts_with(root) {
                out_path = out_path.strip_prefix(root).unwrap().to_path_buf();
            } else {
                continue;
            }
        }

        if out_path.as_os_str().is_empty() {
            continue;
        }

        let dest = out_base.join(&out_path);
        if entry.is_dir() {
            fs::create_dir_all(&dest).map_err(|e| map_io_error("mkdir dir", &dest, e))?;
        } else {
            if let Some(p) = dest.parent() {
                fs::create_dir_all(p).map_err(|e| map_io_error("mkdir parent", p, e))?;
            }
            let mut out = File::create(&dest).map_err(|e| map_io_error("create file", &dest, e))?;
            copy(&mut entry, &mut out)
                .map_err(|e| CommandError::Io(format!("write {:?}: {}", dest, e)))?;
            extracted += 1;
        }
    }

    info!("extracted {} files", extracted);
    if delete_source_on_success {
        fs::remove_file(&src).map_err(|e| map_io_error("delete zip", &src, e))?;
    }
    Ok(out_base)
}

#[command]
pub async fn handle_dropped_zip(
    app: AppHandle,
    zip_path: String,
    target_base: String,
) -> CommandResult<InstallationResult> {
    let src_clone = zip_path.clone();
    let out_dir = tokio::task::spawn_blocking(move || {
        unzip_file_internal(&zip_path, &target_base, true)
    })
    .await
    .map_err(|e| CommandError::TaskJoin(format!("{:?}", e)))??;

    // let the UI know both lists need refreshing
    app.emit("maps-changed", ())
        .map_err(|e| CommandError::Io(format!("emit maps-changed: {}", e)))?;
    app.emit("explorer-changed", ())
        .map_err(|e| CommandError::Io(format!("emit explorer-changed: {}", e)))?;

    Ok(InstallationResult {
        success: true,
        message: format!("Extracted \"{}\"", src_clone),
        final_path: Some(out_dir),
        source: src_clone,
    })
}

#[command]
pub fn save_file(absolute_path: String, contents: Vec<u8>) -> CommandResult<()> {
    let file_path = PathBuf::from(&absolute_path);
    debug!("[fs::save_file] Writing {} bytes to {}", contents.len(), file_path.display());
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| map_io_error("Failed create parent dir", parent, e))?;
    }
    fs::write(&file_path, &contents)
        .map_err(|e| map_io_error("Failed write file", &file_path, e))
}


#[command]
pub fn list_directory_entries(absolute_path: String) -> CommandResult<DirectoryListingResult> {
    let dir_path = PathBuf::from(absolute_path);
    log::debug!("[fs::list_dir] {}", dir_path.display());
    if !dir_path.exists() { return Ok(DirectoryListingResult { status: ListingStatus::DoesNotExist, entries: Vec::new(), path: dir_path }); }
    if !dir_path.is_dir() { return Err(CommandError::Input(format!("Path is not a directory: {}", dir_path.display()))); }

    let mut entries = Vec::new();
    let dir_reader = fs::read_dir(&dir_path).map_err(|e| map_io_error("Failed read directory", &dir_path, e))?;
    for entry_result in dir_reader {
        match entry_result {
            Ok(entry) => {
                match entry.metadata() {
                    Ok(metadata) => {
                        let name = entry.file_name().to_str().map(String::from);
                         if name.is_none() && !metadata.is_dir() { continue; }
                        let modified_time = system_time_to_millis(metadata.modified().ok()).or_else(|| system_time_to_millis(metadata.created().ok()));
                        entries.push(FsEntry { name, path: entry.path(), is_directory: metadata.is_dir(), size: if metadata.is_dir() { None } else { Some(metadata.len()) }, modified: modified_time, thumbnail_path: None, thumbnail_mime_type: None });
                    }
                    Err(e) => log::warn!("[fs::list_dir] Cannot get metadata for {:?}: {}", entry.path(), e),
                }
            }
            Err(e) => log::warn!("[fs::list_dir] Cannot read entry in {}: {}", dir_path.display(), e),
        }
    }
    entries.sort_by(|a, b| { match (a.is_directory, b.is_directory) { (true, false) => std::cmp::Ordering::Less, (false, true) => std::cmp::Ordering::Greater, _ => a.name.as_deref().unwrap_or("").to_ascii_lowercase().cmp(&b.name.as_deref().unwrap_or("").to_ascii_lowercase()), } });
    let status = if entries.is_empty() { ListingStatus::ExistsAndEmpty } else { ListingStatus::ExistsAndPopulated };
    log::debug!("[fs::list_dir] END Status: {:?}, Count: {}", status, entries.len());
    Ok(DirectoryListingResult { status, entries, path: dir_path })
}

#[command]
pub fn create_directory_rust(
  app_handle: AppHandle,
  absolute_path: String
) -> CommandResult<()> {
  let path = std::path::PathBuf::from(&absolute_path);
  log::info!("[fs::create_dir] {}", path.display());
  // 1) create (or error)
  std::fs::create_dir_all(&path)
    .map_err(|e| CommandError::Io(format!("Failed create directory: {}", e)))?;

  // 2) notify front‑end that maps AND explorer should refresh
  app_handle
    .emit("maps-changed", ())
    .map_err(|e| CommandError::Io(format!("Emit maps-changed failed: {}", e)))?;
  app_handle
    .emit("explorer-changed", ())
    .map_err(|e| CommandError::Io(format!("Emit explorer-changed failed: {}", e)))?;

  Ok(())
}

#[command]
pub fn create_empty_file_rust(
  app_handle: AppHandle,
  absolute_path: String
) -> CommandResult<()> {
  let path = std::path::PathBuf::from(&absolute_path);
  log::info!("[fs::create_file] {}", path.display());

  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent)
      .map_err(|e| CommandError::Io(format!("Failed create parent dir: {}", e)))?;
  }
  std::fs::File::create(&path)
    .map_err(|e| CommandError::Io(format!("Failed create file: {}", e)))?;

  // Emit same two events:
  app_handle
    .emit("maps-changed", ())
    .map_err(|e| CommandError::Io(format!("Emit maps-changed failed: {}", e)))?;
  app_handle
    .emit("explorer-changed", ())
    .map_err(|e| CommandError::Io(format!("Emit explorer-changed failed: {}", e)))?;

  Ok(())
}

#[command]
pub fn rename_fs_entry_rust(
  app_handle: AppHandle,
  old_absolute_path: String,
  new_absolute_path: String
) -> CommandResult<()> {
  let old = std::path::PathBuf::from(&old_absolute_path);
  let new = std::path::PathBuf::from(&new_absolute_path);
  log::info!("[fs::rename] {} -> {}", old.display(), new.display());

  std::fs::rename(&old, &new)
    .map_err(|e| CommandError::Io(format!("Failed rename: {}", e)))?;

  // And again, emit both:
  app_handle
    .emit("maps-changed", ())
    .map_err(|e| CommandError::Io(format!("Emit maps-changed failed: {}", e)))?;
  app_handle
    .emit("explorer-changed", ())
    .map_err(|e| CommandError::Io(format!("Emit explorer-changed failed: {}", e)))?;

  Ok(())
}

#[command]
pub fn delete_fs_entry_rust(app_handle: AppHandle, absolute_path: String) -> CommandResult<()> {
    let path_to_delete = PathBuf::from(&absolute_path);
    // Use "Move to Trash" in logs for clarity
    log::info!("[fs::delete] Request to move to trash: {}", path_to_delete.display());

    // --- 1. Update AppData Cache (Before moving to trash) ---
    match app_handle.path().app_data_dir() {
        Ok(data_dir) => {
            let cache_file_path = data_dir.join("map_cache.json"); // ADJUST FILENAME IF NEEDED
            log::debug!("[fs::delete] Attempting to update cache file before trash: {}", cache_file_path.display());
            if cache_file_path.is_file() {
                let read_result = File::open(&cache_file_path).map(BufReader::new);
                if let Ok(reader) = read_result {
                    match serde_json::from_reader::<_, Vec<FsEntry>>(reader) { // ADJUST Vec<FsEntry> IF NEEDED
                        Ok(mut cache_entries) => {
                            let initial_len = cache_entries.len();
                            cache_entries.retain(|entry| entry.path != path_to_delete);
                            if cache_entries.len() < initial_len {
                                log::info!("[fs::delete] Removing entry for '{}' from cache.", path_to_delete.display());
                                let write_result = File::create(&cache_file_path).map(BufWriter::new);
                                if let Ok(writer) = write_result {
                                    if let Err(e) = serde_json::to_writer_pretty(writer, &cache_entries) {
                                        log::warn!("[fs::delete] Failed write updated cache (non-fatal): {}", e);
                                    } else { log::debug!("[fs::delete] Updated cache file successfully."); }
                                } else { log::warn!("[fs::delete] Failed open cache for writing (non-fatal): {}", cache_file_path.display()); }
                            } else { log::debug!("[fs::delete] Entry not found in cache."); }
                        }
                        Err(e) => log::warn!("[fs::delete] Failed parse cache file (non-fatal): {}", e),
                    }
                } else { log::warn!("[fs::delete] Failed open cache for reading (non-fatal): {}", cache_file_path.display()); }
            } else { log::debug!("[fs::delete] Cache file not found, skipping update: {}", cache_file_path.display()); }
        }
        Err(e) => log::warn!("[fs::delete] Could not resolve app data dir for cache update: {}", e),
    }

    // --- 2. Thumbnail Cache Cleanup (Before moving to trash) ---
    {
        if let Ok(cache_base_dir) = app_handle.path().app_cache_dir() {
            let thumbnail_cache_dir = cache_base_dir.join("thumbnails");
            if thumbnail_cache_dir.is_dir() {
                let map_hash = hash_path(&path_to_delete);
                for ext in THUMBNAIL_EXTS.iter() {
                    let cached_path = thumbnail_cache_dir.join(format!("{}.{}", map_hash, ext));
                    if cached_path.exists() {
                        match fs::remove_file(&cached_path) {
                            Ok(_) => log::debug!("[fs::delete] Removed cached thumb: {}", cached_path.display()),
                            Err(e) => log::warn!("[fs::delete] Failed remove cached thumb {}: {}", cached_path.display(), e),
                        }
                    }
                }
            }
        } else { log::warn!("[fs::delete] Could not resolve app cache dir for thumb cleanup"); }
    }

    // --- 3. Move to Trash/Recycle Bin ---
    if !path_to_delete.exists() {
        log::warn!("[fs::delete] Path not found, cannot move to trash: {}", path_to_delete.display());
        // Return Ok because the desired state (item not present) is achieved.
        return Ok(());
    }

    log::info!("[fs::delete] Attempting to move to trash: {}", path_to_delete.display());
    // Use trash::delete - handles both files and directories
    trash::delete(&path_to_delete)
        .map_err(|e| {
            // Map trash::Error to our CommandError::TrashError
            error!("[fs::delete] Failed to move path to trash: {}", e);
            CommandError::TrashError(e.to_string()) // Use the new error variant
        })?; // Propagate the error if map_err results in Err

    // If trash::delete succeeded:
    log::info!("[fs::delete] Successfully moved to trash: {}", path_to_delete.display());
    app_handle
        .emit("maps-changed", ())
        .map_err(|e| CommandError::Io(format!("Failed to emit maps‑changed: {}", e)))?;
    Ok(()) // Return success
}
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
use log::{debug, info, warn, error, trace};
use serde_json;
use trash;

fn map_io_error<S: AsRef<str>>(msg: S, path: &Path, e: std::io::Error) -> CommandError {
    CommandError::Io(format!("{}: {}: {}", msg.as_ref(), path.display(), e))
}

pub fn unzip_file_internal(
    source_path_str: &str,
    target_base_folder_str: &str,
    delete_source_on_success: bool,
) -> CommandResult<PathBuf> {
    info!(
        "[fs::unzip_internal] START: Source='{}', TargetBase='{}', Delete={}",
        source_path_str, target_base_folder_str, delete_source_on_success
    );
    let source_path = PathBuf::from(source_path_str);
    let target_base_path = PathBuf::from(target_base_folder_str);

    // --- 1. Validate Source and Target Base ---
    if !source_path.is_file() { /* ... error handling ... */ }
    if !target_base_path.exists() { /* ... create target base ... */ }
    else if !target_base_path.is_dir() { /* ... error handling ... */ }
    debug!("[fs::unzip_internal] Target base path validated: {}", target_base_path.display());

    // --- 2. Determine Target Folder Name and Extraction Strategy (Metadata Scan) ---
    let final_target_dir: PathBuf;
    let common_root_to_strip: Option<String>;

    { // Metadata scope
        debug!("[fs::unzip_internal] Reading archive metadata for structure and largest file...");
        let zip_file_meta = File::open(&source_path).map_err(|e| map_io_error("Failed open zip (meta)", &source_path, e))?;
        let mut archive_meta = ZipArchive::new(zip_file_meta).map_err(|e| CommandError::Zip(format!("Failed read archive (meta) {}: {}", source_path.display(), e)))?;
        let file_count = archive_meta.len();
        debug!("[fs::unzip_internal] Archive contains {} entries.", file_count);

        if file_count == 0 {
            warn!("[fs::unzip_internal] Zip file is empty.");
            // Create an empty folder named after the zip file stem
            let folder_name = source_path.file_stem().and_then(OsStr::to_str).map(String::from).filter(|s| !s.is_empty()).unwrap_or_else(|| format!("empty_zip_{}", Uuid::new_v4()));
            final_target_dir = target_base_path.join(&folder_name);
            info!("[fs::unzip_internal] Empty zip - creating target dir: {}", final_target_dir.display());
            fs::create_dir_all(&final_target_dir).map_err(|e| map_io_error("Failed create dir for empty zip", &final_target_dir, e))?;
            return Ok(final_target_dir);
        }

        let mut top_level_items = HashSet::new();
        let mut first_dir_name: Option<String> = None;
        let mut has_files_at_root = false;
        let mut largest_file_size: u64 = 0;
        // Store the PathBuf of the largest file to easily get stem later
        let mut largest_file_path: Option<PathBuf> = None;

        for i in 0..file_count {
             if let Ok(file) = archive_meta.by_index(i) {
                let path = file.mangled_name();
                let is_dir_entry = file.name().ends_with('/') || file.is_dir(); // Check both
                trace!("[fs::unzip_internal] Meta scan - Index {}: Path='{:?}', IsDir={}", i, path, is_dir_entry);

                if path.components().any(|comp| comp.as_os_str() == "..") { return Err(CommandError::Input(format!("Zip contains '..': {:?}", path))); }

                let mut components = path.components();
                if let Some(first_comp) = components.next() {
                    let part_os = first_comp.as_os_str();
                    let part = part_os.to_string_lossy().to_string();

                    if !part.is_empty() {
                        top_level_items.insert(part.clone());

                        if components.next().is_none() && !is_dir_entry {
                            // File directly at root level
                            has_files_at_root = true;
                            trace!("[fs::unzip_internal] Detected file at root level: {:?}", path);
                            // Track largest file *at root* (or anywhere?) - let's track largest anywhere for simplicity now
                            if file.size() > largest_file_size {
                                largest_file_size = file.size();
                                largest_file_path = Some(path.clone()); // Store PathBuf
                                trace!("[fs::unzip_internal] New largest file found: {:?} ({} bytes)", path, largest_file_size);
                            }
                        } else if !is_dir_entry {
                            // File inside a directory - track largest
                             if file.size() > largest_file_size {
                                largest_file_size = file.size();
                                largest_file_path = Some(path.clone());
                                trace!("[fs::unzip_internal] New largest file found: {:?} ({} bytes)", path, largest_file_size);
                            }
                        } else if first_dir_name.is_none() {
                             // Directory at root level - track first one encountered
                            first_dir_name = Some(part);
                        }
                    } else { has_files_at_root = true; } // Empty component means multi-root effectively
                } else { has_files_at_root = true; } // Path with no components means multi-root
            } else { warn!("[fs::unzip_internal] Cannot read file index {} (meta)", i); }
        }

        // --- Decide on the final folder name and stripping strategy ---
        let target_folder_name: String;
        if !has_files_at_root && top_level_items.len() == 1 && first_dir_name.is_some() {
            // Case 1: Single top-level directory.
            target_folder_name = first_dir_name.clone().unwrap();
            common_root_to_strip = Some(target_folder_name.clone());
            debug!("[fs::unzip_internal] Strategy: Single root folder detected ('{}').", target_folder_name);
        } else {
            // Case 2: Multiple items or files at root. Create new folder.
            common_root_to_strip = None; // Don't strip anything.
            // Try naming after the largest file's stem.
            target_folder_name = largest_file_path
                .as_ref() // Option<&PathBuf>
                .and_then(|p| p.file_stem()) // Option<&OsStr>
                .and_then(|s| s.to_str()) // Option<&str>
                .map(String::from) // Option<String>
                .filter(|s| !s.is_empty()) // Ensure stem is usable
                .map(|stem| {
                    debug!("[fs::unzip_internal] Strategy: Multi-root/Files at root. Using largest file stem '{}'.", stem);
                    stem // Use the derived stem
                })
                .unwrap_or_else(|| { // Fallback 1: Use zip filename stem
                    source_path.file_stem()
                        .and_then(OsStr::to_str)
                        .map(String::from)
                        .filter(|s| !s.is_empty())
                        .map(|stem| {
                            debug!("[fs::unzip_internal] Strategy: Multi-root/Files at root. Using zip file stem '{}' as fallback.", stem);
                            stem
                        })
                        .unwrap_or_else(|| { // Fallback 2: Use UUID
                            warn!("[fs::unzip_internal] Using UUID fallback name for target folder.");
                            format!("unzipped_{}", Uuid::new_v4())
                        })
                });
            debug!("[fs::unzip_internal] Strategy: Multi-root/Files at root. Final folder name selected: '{}'.", target_folder_name);
        }

        final_target_dir = target_base_path.join(&target_folder_name);
        info!("[fs::unzip_internal] Final calculated extraction target directory: {}", final_target_dir.display());

    } // End metadata scope

    // --- 3. Create the Final Target Directory ---
    info!("[fs::unzip_internal] Ensuring final target directory exists: {}", final_target_dir.display());
    fs::create_dir_all(&final_target_dir).map_err(|e| map_io_error("Failed create final target dir", &final_target_dir, e))?;

    // --- 4. Perform Extraction into the Target Directory ---
    info!("[fs::unzip_internal] Starting extraction pass into {}", final_target_dir.display());
    let zip_file_extract = File::open(&source_path).map_err(|e| map_io_error("Failed re-open zip (extract)", &source_path, e))?;
    let mut archive_extract = ZipArchive::new(zip_file_extract).map_err(|e| CommandError::Zip(format!("Failed re-read archive (extract) {}: {}", source_path.display(), e)))?;
    let mut extracted_count = 0;

    for i in 0..archive_extract.len() {
        let mut file = match archive_extract.by_index(i) { Ok(f) => f, Err(e) => { warn!("[fs::unzip_internal] Err reading extract idx {}: {}", i, e); continue; } };
        let original_path = file.mangled_name();
        trace!("[fs::unzip_internal] Processing entry {}: OriginalPath='{:?}', Size={}", i, original_path, file.size());

        if original_path.components().any(|comp| comp.as_os_str() == "..") { /* ... skip ... */ continue; }

        // Apply stripping logic based on the determined strategy
        let path_to_write = if let Some(ref root_to_strip) = common_root_to_strip {
            let root_path = PathBuf::from(root_to_strip);
            if original_path.starts_with(&root_path) && original_path != root_path {
                original_path.strip_prefix(&root_path).unwrap().to_path_buf()
            } else if original_path == root_path {
                 trace!("[fs::unzip_internal] Skipping root dir entry itself: {:?}", original_path);
                 continue;
            } else {
                 warn!("[fs::unzip_internal] Entry {:?} != common root '{}' during single-root extraction.", original_path, root_to_strip);
                 original_path.clone()
            }
        } else {
            original_path.clone()
        };

        if path_to_write.as_os_str().is_empty() { trace!("[fs::unzip_internal] Skipping empty path after strip for index {}", i); continue; }

        // Join with the single final_target_dir
        let outpath = final_target_dir.join(&path_to_write);
        trace!("[fs::unzip_internal] Index {}: Target output path: {}", i, outpath.display());

        if !outpath.starts_with(&final_target_dir) { /* ... Zip Slip error ... */ continue; }

        // File/Directory creation logic
        if file.name().ends_with('/') || file.is_dir() {
            trace!("[fs::unzip_internal] Creating dir: {}", outpath.display());
            fs::create_dir_all(&outpath).map_err(|e| map_io_error("Failed create dir", &outpath, e))?;
            // Optionally count directories: extracted_count += 1;
        } else {
            if let Some(p) = outpath.parent() { if !p.exists() { trace!("[fs::unzip_internal] Creating parent dir: {}", p.display()); fs::create_dir_all(p).map_err(|e| map_io_error("Failed create parent", p, e))?; } }
            trace!("[fs::unzip_internal] Creating file: {}", outpath.display());
            {
                let mut outfile = File::create(&outpath).map_err(|e| map_io_error("Failed create file", &outpath, e))?;
                let bytes_copied = copy(&mut file, &mut outfile).map_err(|e| CommandError::Io(format!("Failed copy to {}: {}", outpath.display(), e)))?;
                trace!("[fs::unzip_internal] Copied {} bytes to {}", bytes_copied, outpath.display());
                extracted_count += 1; // Count extracted files
            }
        }
        #[cfg(unix)]
        { /* ... permissions ... */ }
    }
    drop(archive_extract);
    info!("[fs::unzip_internal] Extraction pass complete. Extracted {} file entries.", extracted_count);

    // --- 5. Conditional Cleanup ---
    if delete_source_on_success { /* ... */ } else { info!("[fs::unzip_internal] Skipping source delete."); }

    info!("[fs::unzip_internal] FINISHED Successfully. Returning final target dir: {}", final_target_dir.display());
    Ok(final_target_dir)
}

#[command]
pub async fn handle_dropped_zip(
    app_handle: AppHandle,              // <-- dropped underscore here
    zip_path: String,
    target_base_folder: String,
) -> CommandResult<InstallationResult> {
    info!("[fs::handle_dropped_zip] Source='{}', TargetBase='{}'", zip_path, target_base_folder);

    let original_source = zip_path.clone();
    let unzip_result = tokio::task::spawn_blocking(move || {
        unzip_file_internal(&zip_path, &target_base_folder, false)
    })
    .await
    .map_err(|e| {
        error!("[fs::handle_dropped_zip] Task panicked: {}", e);
        CommandError::TaskJoin(format!("Unzip task panicked: {}", e))
    })?;

    match unzip_result {
        Ok(final_path) => {
            let success_msg = format!("Processed local zip: {}", original_source);
            info!("[fs::handle_dropped_zip] {}", success_msg);

            app_handle
            .emit("maps-changed", ())
            .map_err(|e| CommandError::Io(format!("Failed to emit maps-changed: {}", e)))?;

            // 2) Tell the Explorer store to reload (if you want your Explorer tab to update too)
            app_handle
            .emit("explorer-changed", ())
            .map_err(|e| CommandError::Io(format!("Failed to emit explorer-changed: {}", e)))?;

            Ok(InstallationResult {
             success: true,
            message: success_msg,
            final_path: Some(final_path),
            source: original_source,
            })
        }
        Err(e) => {
            error!("[fs::handle_dropped_zip] Unzip failed: {:?}", e);
            Err(e)
        }
    }
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
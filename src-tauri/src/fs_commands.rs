// src-tauri/src/fs_commands.rs

use crate::error::{CommandError, CommandResult};
use crate::models::{FsEntry, DirectoryListingResult, ListingStatus, InstallationResult};
use crate::utils::{system_time_to_millis, THUMBNAIL_EXTS, hash_path};

use std::{
    collections::HashSet,
    fs::{self, File},
    io::copy,
    path::PathBuf,
};
use tauri::{command, AppHandle, Manager};
use uuid::Uuid;
use zip::ZipArchive;
use log::{debug, info, error};

fn map_io_error<S: AsRef<str>>(msg: S, path: &std::path::Path, e: std::io::Error) -> CommandError {
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

    let meta_file = File::open(&src).map_err(|e| map_io_error("open zip for meta", &src, e))?;
    let mut meta = ZipArchive::new(meta_file)
        .map_err(|e| CommandError::Zip(format!("read zip meta: {}", e)))?;
    let count = meta.len();
    debug!("archive contains {} entries", count);

    if count == 0 {
        let stem = src
            .file_stem()
            .and_then(|s| s.to_str())
            .filter(|s| !s.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| format!("empty_zip_{}", Uuid::new_v4()));
        let out = base.join(&stem);
        fs::create_dir_all(&out).map_err(|e| map_io_error("mkdir empty", &out, e))?;
        return Ok(out);
    }

    // Gather top-level roots and track largest file
    let mut roots = HashSet::new();
    let mut has_root_file = false;
    let mut largest: Option<(u64, PathBuf)> = None;

    for i in 0..count {
        let entry = meta.by_index(i).map_err(|e| CommandError::Zip(e.to_string()))?;
        let path = entry.mangled_name();
        if path.components().any(|c| c.as_os_str() == "..") {
            return Err(CommandError::Input(format!("unsafe path {:?}", path)));
        }
        if let Some(first) = path.components().next() {
            let s = first.as_os_str().to_string_lossy().to_string();
            roots.insert(s.clone());
            if path.components().count() == 1 && !entry.is_dir() {
                has_root_file = true;
            }
        }
        if !entry.is_dir() {
            let sz = entry.size();
            if largest.as_ref().map_or(true, |(prev, _)| sz > *prev) {
                largest = Some((sz, path.clone()));
            }
        }
    }

    // Decide output base + strip root folder if single
    let (out_base, strip_root) = if roots.len() == 1 && !has_root_file {
        let only = roots.into_iter().next().unwrap();
        (base.join(&only), Some(only))
    } else {
        let name = largest
            .as_ref()
            .and_then(|(_, p)| p.file_stem().and_then(|s| s.to_str()).map(str::to_string))
            .or_else(|| src.file_stem().and_then(|s| s.to_str()).map(str::to_string))
            .unwrap_or_else(|| format!("unzipped_{}", Uuid::new_v4()));
        (base.join(&name), None)
    };

    fs::create_dir_all(&out_base).map_err(|e| map_io_error("mkdir out_base", &out_base, e))?;
    info!("extracting into {:?}", out_base);

    let extract_file = File::open(&src).map_err(|e| map_io_error("open zip for extract", &src, e))?;
    let mut archive = ZipArchive::new(extract_file)
        .map_err(|e| CommandError::Zip(format!("read zip extract: {}", e)))?;

    let mut extracted = 0;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| CommandError::Zip(e.to_string()))?;
        let mut out_path = entry.mangled_name();
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
    zip_path: String,
    target_base_folder: String,
) -> CommandResult<InstallationResult> {
    let src_clone = zip_path.clone();
    let out_dir = tokio::task::spawn_blocking(move || {
        unzip_file_internal(&zip_path, &target_base_folder, true)
    })
    .await
    .map_err(|e| CommandError::TaskJoin(e.to_string()))??;

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
            .map_err(|e| map_io_error("create parent dir", parent, e))?;
    }
    fs::write(&file_path, &contents)
        .map_err(|e| map_io_error("write file", &file_path, e))
}

#[command]
pub fn list_directory_entries(absolute_path: String) -> CommandResult<DirectoryListingResult> {
    let dir_path = PathBuf::from(absolute_path);
    debug!("[fs::list_dir] {}", dir_path.display());
    if !dir_path.exists() {
        return Ok(DirectoryListingResult {
            status: ListingStatus::DoesNotExist,
            entries: Vec::new(),
            path: dir_path,
        });
    }
    if !dir_path.is_dir() {
        return Err(CommandError::Input(format!("Not a directory: {}", dir_path.display())));
    }

    let mut entries = Vec::new();
    for ent in fs::read_dir(&dir_path).map_err(|e| map_io_error("read dir", &dir_path, e))? {
        if let Ok(entry) = ent {
            if let Ok(meta) = entry.metadata() {
                let name = entry.file_name().to_str().map(String::from);
                if name.is_none() && !meta.is_dir() { continue; }
                let modified = system_time_to_millis(meta.modified().ok())
                    .or_else(|| system_time_to_millis(meta.created().ok()));
                entries.push(FsEntry {
                    name,
                    path: entry.path(),
                    is_directory: meta.is_dir(),
                    size: if meta.is_dir() { None } else { Some(meta.len()) },
                    modified,
                    thumbnail_path: None,
                    thumbnail_mime_type: None,
                });
            }
        }
    }

    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.as_deref().unwrap_or("").to_ascii_lowercase()
               .cmp(&b.name.as_deref().unwrap_or("").to_ascii_lowercase()),
    });

    let status = if entries.is_empty() {
        ListingStatus::ExistsAndEmpty
    } else {
        ListingStatus::ExistsAndPopulated
    };
    Ok(DirectoryListingResult { status, entries, path: dir_path })
}

#[command]
pub fn create_directory_rust(absolute_path: String) -> CommandResult<()> {
    let path = PathBuf::from(&absolute_path);
    info!("[fs::create_dir] {}", path.display());
    fs::create_dir_all(&path)
        .map_err(|e| CommandError::Io(format!("Failed create directory: {}", e)))?;
    Ok(())
}

#[command]
pub fn create_empty_file_rust(absolute_path: String) -> CommandResult<()> {
    let path = PathBuf::from(&absolute_path);
    info!("[fs::create_file] {}", path.display());
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| CommandError::Io(format!("Failed create parent: {}", e)))?;
    }
    File::create(&path)
        .map_err(|e| CommandError::Io(format!("Failed create file: {}", e)))?;
    Ok(())
}

#[command]
pub fn rename_fs_entry_rust(old_path: String, new_path: String) -> CommandResult<()> {
    let old = PathBuf::from(&old_path);
    let new = PathBuf::from(&new_path);
    info!("[fs::rename] {} -> {}", old.display(), new.display());
    fs::rename(&old, &new)
        .map_err(|e| CommandError::Io(format!("Failed rename: {}", e)))?;
    Ok(())
}

#[command]
pub fn delete_fs_entry_rust(app_handle: AppHandle, absolute_path: String) -> CommandResult<()> {
    let path = PathBuf::from(&absolute_path);
    info!("[fs::delete] Moving to trash: {}", path.display());

    if !path.exists() {
        debug!("[fs::delete] Not found, skipping: {}", path.display());
        return Ok(());
    }
    trash::delete(&path).map_err(|e| {
        error!("[fs::delete] Trash failed: {}", e);
        CommandError::TrashError(e.to_string())
    })?;

    // purge thumbnail cache
    if let Ok(cache_dir) = app_handle.path().app_cache_dir() {
        let thumb_dir = cache_dir.join("thumbnails");
        if thumb_dir.is_dir() {
            let key = hash_path(&path);
            for ext in THUMBNAIL_EXTS.iter() {
                let f = thumb_dir.join(format!("{}.{}", key, ext));
                let _ = fs::remove_file(f);
            }
        }
    }
    Ok(())
}

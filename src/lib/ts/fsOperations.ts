import { invoke } from "@tauri-apps/api/core";
import { documentDir, normalize, join } from "@tauri-apps/api/path";
import { handleError } from "./errorHandler";

export function normalizePath(path: string | null | undefined): string {
  if (!path) return "";
  return path.replace(/\\/g, "/");
}

// --- Types matching Rust structs ---
export enum ListingStatus {
  ExistsAndPopulated = "existsAndPopulated",
  ExistsAndEmpty = "existsAndEmpty",
  DoesNotExist = "doesNotExist",
}

export interface FsEntry {
  name: string | null;
  path: string; // Absolute path
  isDirectory: boolean;
  size: number | null;
  modified: number | null;
  thumbnailPath: string | null; // Absolute path
  thumbnailMimeType: string | null;
}

export interface DirectoryListingResult {
  status: ListingStatus;
  entries: FsEntry[];
  path: string; // Absolute path checked
}
// --- End Types ---

export const baseFolder = "SkaterXL"; // Keep if needed for initial path construction

// Keep getDocumentDir if needed elsewhere, but CRUD uses absolute paths now
let documentDirPath: string | null = null;
async function getDocumentDir(): Promise<string> {
  if (!documentDirPath) {
    documentDirPath = normalizePath(await documentDir());
  }
  return documentDirPath;
}

// --- Updated Listing Functions ---
export async function loadLocalMaps(
  relativeMapsPath: string
): Promise<DirectoryListingResult> {
  try {
    const result = await invoke<DirectoryListingResult>("list_local_maps", {
      relativeMapsPath: normalizePath(relativeMapsPath),
    });
    result.path = normalizePath(result.path);
    result.entries = result.entries.map((e) => ({
      ...e,
      path: normalizePath(e.path),
      thumbnailPath: e.thumbnailPath ? normalizePath(e.thumbnailPath) : null,
    }));
    return result;
  } catch (error) {
    handleError(error, `loading local maps from ${relativeMapsPath}`);
    throw error;
  }
}

export async function loadDirectoryEntries(
  absolutePath: string
): Promise<DirectoryListingResult> {
  try {
    const result = await invoke<DirectoryListingResult>(
      "list_directory_entries",
      { absolutePath: normalizePath(absolutePath) }
    );
    result.path = normalizePath(result.path);
    result.entries = result.entries.map((e) => ({
      ...e,
      path: normalizePath(e.path),
      thumbnailPath: null, // Generic lister doesn't provide thumbs
      thumbnailMimeType: null,
    }));
    return result;
  } catch (error) {
    handleError(error, `loading directory entries for ${absolutePath}`);
    throw error;
  }
}

// --- CRUD Functions use Absolute Paths ---
export async function createDirectoryFs(absolutePath: string): Promise<void> {
  try {
    await invoke("create_directory_rust", {
      absolutePath: normalizePath(absolutePath),
    });
  } catch (error) {
    handleError(error, `creating directory ${absolutePath}`);
    throw error;
  }
}

export async function createFileFs(absolutePath: string): Promise<void> {
  try {
    await invoke("create_empty_file_rust", {
      absolutePath: normalizePath(absolutePath),
    });
  } catch (error) {
    handleError(error, `creating file ${absolutePath}`);
    throw error;
  }
}

export async function renameEntryFs(
  oldAbsolutePath: string,
  newAbsolutePath: string
): Promise<void> {
  if (
    !newAbsolutePath ||
    !oldAbsolutePath ||
    oldAbsolutePath === newAbsolutePath
  ) {
    throw new Error("Invalid paths provided for rename operation.");
  }
  try {
    await invoke("rename_fs_entry_rust", {
      oldAbsolutePath: normalizePath(oldAbsolutePath),
      newAbsolutePath: normalizePath(newAbsolutePath),
    });
  } catch (error) {
    handleError(error, `renaming ${oldAbsolutePath} to ${newAbsolutePath}`);
    throw error;
  }
}

export async function deleteEntryFs(absolutePath: string): Promise<void> {
  try {
    await invoke("delete_fs_entry_rust", {
      absolutePath: normalizePath(absolutePath),
    });
  } catch (error) {
    handleError(error, `deleting ${absolutePath}`);
    throw error;
  }
}

// download_and_install remains the same interface, Rust handles path resolution
export async function downloadAndInstall(
  url: string,
  destinationSubfolder: string
): Promise<void> {
  try {
    await invoke("download_and_install", { url, destinationSubfolder });
  } catch (error) {
    handleError(
      error,
      `downloading/installing from ${url} to ${destinationSubfolder}`
    );
    throw error;
  }
}

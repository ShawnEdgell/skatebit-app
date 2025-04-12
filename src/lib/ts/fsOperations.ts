// src/lib/ts/fsOperations.ts
import { invoke } from "@tauri-apps/api/core";
import { documentDir, normalize, join } from "@tauri-apps/api/path";
import { BaseDirectory } from "@tauri-apps/plugin-fs";
import { handleError } from "./errorHandler";

export function normalizePath(path: string | null | undefined): string {
  if (!path) return "";
  return path.replace(/\\/g, "/");
}

export interface FsEntry {
  name: string | null;
  path: string;
  isDirectory: boolean;
  size: number | null;
  modified: number | null;
  thumbnailPath: string | null;
  thumbnailMimeType: string | null;
  relativeThumbnailPath?: string | null;
}

export const baseFolder = "SkaterXL";

let documentDirPath: string | null = null;
async function getDocumentDir(): Promise<string> {
  if (!documentDirPath) {
    documentDirPath = await normalize(await documentDir());
    console.log("Document directory initialized:", documentDirPath);
  }
  return documentDirPath;
}

export async function loadLocalMapsSimple(
  relativeMapsPath: string
): Promise<FsEntry[]> {
  try {
    const normalizedRelativePath = normalizePath(relativeMapsPath);
    console.log(
      `[fsOps|loadLocalMapsSimple] Invoking list_local_maps for relative path: ${normalizedRelativePath}`
    );
    const entriesFromRust = await invoke<any[]>("list_local_maps", {
      relativeMapsPath: normalizedRelativePath,
    });
    console.log(
      `[fsOps|loadLocalMapsSimple] Raw entries received from Rust (${entriesFromRust.length}):`,
      JSON.parse(JSON.stringify(entriesFromRust))
    );
    const docDir = await getDocumentDir();
    if (!docDir) {
      throw new Error("Failed to get document directory path.");
    }

    const processedEntries = entriesFromRust.map((entry, index) => {
      let relativeThumbnailPath: string | null = null;
      if (entry?.thumbnail_path) {
        const normalizedThumbPath = normalizePath(entry.thumbnail_path);
        if (normalizedThumbPath.startsWith(docDir)) {
          relativeThumbnailPath = normalizedThumbPath
            .substring(docDir.length)
            .replace(/^[\/\\]/, "");
        } else {
          console.warn(
            `[fsOps|loadLocalMapsSimple] Thumbnail path ${normalizedThumbPath} is outside document directory ${docDir}. Using absolute.`
          );
          relativeThumbnailPath = normalizedThumbPath;
        }
      }
      if (entry == null || entry.path == null || entry.path === "") {
        console.error(
          `[fsOps|loadLocalMapsSimple] !!! CRITICAL ERROR !!! Entry [${index}] from Rust missing 'path'!`,
          JSON.parse(JSON.stringify(entry))
        );
      }
      if (entry == null || entry.name === undefined) {
        console.warn(
          `[fsOps|loadLocalMapsSimple] Entry [${index}] missing 'name'.`,
          JSON.parse(JSON.stringify(entry))
        );
      }

      const processedEntry: FsEntry = {
        name: entry?.name ?? null,
        path: normalizePath(entry?.path),
        isDirectory: entry?.is_directory ?? false,
        size: entry?.size ?? null,
        modified: entry?.modified ?? null,
        thumbnailPath: normalizePath(entry?.thumbnail_path),
        thumbnailMimeType: entry?.thumbnail_mime_type ?? null,
        relativeThumbnailPath: normalizePath(relativeThumbnailPath),
      };
      return processedEntry;
    });

    console.log(
      `[fsOps|loadLocalMapsSimple] Final processed entries array (${processedEntries.length}):`,
      JSON.parse(JSON.stringify(processedEntries))
    );
    const finalHasMissingPaths = processedEntries.some((e) => !e.path);
    if (finalHasMissingPaths) {
      console.error(
        `[fsOps|loadLocalMapsSimple] !!! FINAL CHECK FAILED !!! Missing 'path'!`,
        processedEntries.filter((e) => !e.path)
      );
    }
    return processedEntries;
  } catch (error) {
    handleError(error, `loading local maps via Rust from ${relativeMapsPath}`);
    return [];
  }
}

// *** UPDATED loadEntries ***
export async function loadEntries(
  absolutePath: string // Expect absolute path from explorerStore
): Promise<FsEntry[]> {
  try {
    // Directly use the absolute path provided
    const normalizedAbsPath = normalizePath(absolutePath);
    if (!normalizedAbsPath) {
      throw new Error("Provided absolute path is empty or invalid.");
    }

    console.log(
      `[fsOps|loadEntries] Invoking list_directory_entries for ABSOLUTE path: ${normalizedAbsPath}`
    );

    // *** Pass the absolute path directly to the Rust command ***
    const entriesFromRust = await invoke<any[]>("list_directory_entries", {
      absolutePath: normalizedAbsPath, // Match the parameter name in Rust command definition
    });

    console.log(
      `[fsOps|loadEntries] Raw entries received from Rust (${entriesFromRust.length}):`,
      JSON.parse(JSON.stringify(entriesFromRust))
    );

    const processedEntries = entriesFromRust.map((entry, index) => {
      if (entry == null || entry.path == null || entry.path === "") {
        console.error(
          `[fsOps|loadEntries] !!! CRITICAL ERROR !!! Entry [${index}] from Rust missing 'path'!`,
          JSON.parse(JSON.stringify(entry))
        );
      }
      if (entry == null || entry.name === undefined) {
        console.warn(
          `[fsOps|loadEntries] Entry [${index}] missing 'name'.`,
          JSON.parse(JSON.stringify(entry))
        );
      }

      const processedEntry: FsEntry = {
        name: entry?.name ?? null,
        path: normalizePath(entry?.path), // Path from Rust is already absolute
        isDirectory: entry?.is_directory ?? false,
        size: entry?.size ?? null,
        modified: entry?.modified ?? null,
        thumbnailPath: null,
        thumbnailMimeType: null,
      };
      return processedEntry;
    });

    console.log(
      `[fsOps|loadEntries] Final processed entries array (${processedEntries.length}):`,
      JSON.parse(JSON.stringify(processedEntries))
    );
    const finalHasMissingPaths = processedEntries.some((e) => !e.path);
    if (finalHasMissingPaths) {
      console.error(
        `[fsOps|loadEntries] !!! FINAL CHECK FAILED !!! Missing 'path'!`,
        processedEntries.filter((e) => !e.path)
      );
    }
    return processedEntries;
  } catch (error) {
    // Make error message clearer
    handleError(
      error,
      `reading directory contents via Rust for ${absolutePath}`
    );
    return [];
  }
}

// --- CRUD functions still require RELATIVE paths for Rust commands ---
export async function createFolder(
  currentRelativePath: string,
  folderName: string
): Promise<void> {
  try {
    const newFolderPath = normalizePath(
      await join(currentRelativePath, folderName)
    );
    await invoke("create_directory_rust", { relativePath: newFolderPath });
  } catch (error) {
    handleError(error, `creating folder "${folderName}" via Rust`);
    throw error;
  }
}

export async function createFile(
  currentRelativePath: string,
  fileName: string
): Promise<void> {
  try {
    const newFilePath = normalizePath(
      await join(currentRelativePath, fileName)
    );
    await invoke("create_empty_file_rust", { relativePath: newFilePath });
  } catch (err) {
    handleError(err, `creating file "${fileName}" via Rust`);
    throw err;
  }
}

export async function renameEntry(
  currentRelativePath: string,
  oldName: string,
  newName: string
): Promise<void> {
  if (!newName || oldName === newName) return;
  try {
    await invoke("rename_fs_entry_rust", {
      relativeDirPath: normalizePath(currentRelativePath),
      oldName: oldName,
      newName: newName,
    });
  } catch (error) {
    handleError(error, `renaming "${oldName}" to "${newName}" via Rust`);
    throw error;
  }
}

export async function deleteEntry(
  currentRelativePath: string,
  name: string
): Promise<boolean> {
  try {
    const itemPathToDelete = normalizePath(
      await join(currentRelativePath, name)
    );
    await invoke("delete_fs_entry_rust", { relativePath: itemPathToDelete });
    return true;
  } catch (error) {
    handleError(error, `deleting "${name}" via Rust`);
    return false;
  }
}

// src/lib/ts/fsOperations.ts
import { join, documentDir } from "@tauri-apps/api/path";
import {
  readDir,
  BaseDirectory,
  create,
  mkdir,
  rename,
  remove,
} from "@tauri-apps/plugin-fs";
import type { DirEntry } from "@tauri-apps/plugin-fs";
import { handleError } from "./errorHandler";
import { normalizePath } from "./pathUtils";

// Update baseFolder to include "Documents", so our allowed scope is "Documents/SkaterXL"
export const baseFolder = "SkaterXL";

/**
 * Loads the contents of a folder (e.g. Documents/SkaterXL/Maps)
 * and returns entries that are either directories or files that do not have
 * disallowed image extensions.
 */
export async function loadLocalMapsSimple(
  mapsFolder: string
): Promise<DirEntry[]> {
  try {
    const entries = await readDir(mapsFolder, {
      baseDir: BaseDirectory.Document,
    });
    console.debug("readDir returned:", entries);

    // List of file extensions to filter out (in lowercase)
    const disallowedExts = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];

    const filtered = entries.filter((entry) => {
      // Always keep directories.
      if (entry.isDirectory) return true;
      // For files, check if the extension is disallowed.
      const lowerName = entry.name.toLowerCase();
      // Return true if none of the disallowed extensions match.
      return !disallowedExts.some((ext) => lowerName.endsWith(ext));
    });

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error loading local maps:", error);
    return [];
  }
}

export async function loadEntries(currentPath: string): Promise<DirEntry[]> {
  try {
    const entries = await readDir(currentPath, {
      baseDir: BaseDirectory.Document,
    });
    return entries.sort((a, b) =>
      a.isDirectory === b.isDirectory
        ? a.name.localeCompare(b.name)
        : a.isDirectory
        ? -1
        : 1
    );
  } catch (error) {
    handleError(error, "reading directory");
    return [];
  }
}

export async function openDirectory(
  currentPath: string,
  dirName: string
): Promise<string> {
  return normalizePath(`${currentPath}/${dirName}`);
}

export async function goUp(currentPath: string): Promise<string> {
  const normalized = normalizePath(currentPath);
  if (normalized === baseFolder) return normalized;
  return normalized.split("/").slice(0, -1).join("/");
}

export async function promptNewFolder(currentPath: string): Promise<void> {
  const folderName = prompt("Enter new folder name:");
  if (folderName) {
    try {
      await mkdir(normalizePath(`${currentPath}/${folderName}`), {
        baseDir: BaseDirectory.Document,
      });
    } catch (error) {
      handleError(error, "creating new folder");
    }
  }
}

export async function promptNewFile(currentPath: string): Promise<void> {
  const fileName = prompt("Enter new file name:");
  if (fileName) {
    try {
      await create(normalizePath(`${currentPath}/${fileName}`), {
        baseDir: BaseDirectory.Document,
      });
    } catch (err) {
      handleError(err, "creating new file");
    }
  }
}

export async function renameEntry(
  currentPath: string, // This should be the relative path, e.g. "SkaterXL"
  oldName: string
): Promise<void> {
  const newEntryName = prompt("New name:", oldName);
  if (!newEntryName) return;
  try {
    // Get the absolute Documents directory.
    const docsDir = await documentDir();
    // Build absolute paths. For example, if docsDir is "C:/Users/username/Documents",
    // currentPath is "SkaterXL", and oldName is "11111", then:
    // oldPath -> "C:/Users/username/Documents/SkaterXL/11111"
    const oldPath = await join(docsDir, currentPath, oldName);
    const newPath = await join(docsDir, currentPath, newEntryName);
    await rename(oldPath, newPath);
  } catch (error) {
    handleError(error, "renaming entry");
  }
}

export async function deleteEntry(
  currentPath: string,
  name: string
): Promise<boolean> {
  // The confirmation now happens here.
  const confirmed = confirm(`Delete "${name}"? This action cannot be undone.`);
  if (!confirmed) return false; // User canceled
  try {
    await remove(`${currentPath}/${name}`, {
      baseDir: BaseDirectory.Document,
      recursive: true,
    });
    return true;
  } catch (error) {
    handleError(error, "deleting entry");
    throw error;
  }
}

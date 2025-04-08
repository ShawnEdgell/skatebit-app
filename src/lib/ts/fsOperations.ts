// src/lib/ts/fsOperations.ts
import { join, documentDir } from "@tauri-apps/api/path";
import {
  readDir,
  stat,
  BaseDirectory,
  create,
  mkdir,
  rename,
  remove,
  type DirEntry,
} from "@tauri-apps/plugin-fs";
import { handleError } from "./errorHandler";
import { normalizePath } from "./pathUtils";

// The baseFolder is relative to Documents.
export const baseFolder = "SkaterXL";

/**
 * Loads the contents of a folder (e.g. Documents/SkaterXL/Maps)
 * and returns entries that are either directories or files that do not have
 * disallowed image extensions. For files, we additionally fetch the file size.
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

    // Filter out unwanted files (keeping directories).
    let filtered = entries.filter((entry) => {
      if (entry.isDirectory) return true;
      const lowerName = entry.name.toLowerCase();
      return !disallowedExts.some((ext) => lowerName.endsWith(ext));
    });

    // For each non-directory, retrieve file size via stat.
    filtered = await Promise.all(
      filtered.map(async (entry) => {
        if (!entry.isDirectory) {
          try {
            // Use join to build an accurate file path.
            const filePath = await join(mapsFolder, entry.name);
            // Call stat on the joined path.
            const statInfo = await stat(filePath, {
              baseDir: BaseDirectory.Document,
            });
            // Attach the size property (casting to any because DirEntry doesn't include it).
            (entry as any).size = statInfo.size;
            console.debug(`File "${entry.name}" size:`, statInfo.size);
          } catch (e) {
            console.error("Error retrieving stat for", entry.name, e);
          }
        }
        return entry;
      })
    );

    console.debug("Filtered entries after attaching size:", filtered);
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
  currentPath: string,
  oldName: string
): Promise<void> {
  const newEntryName = prompt("New name:", oldName);
  if (!newEntryName) return;
  try {
    const oldPath = await join(currentPath, oldName);
    const newPath = await join(currentPath, newEntryName);
    // Call rename without extra options.
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

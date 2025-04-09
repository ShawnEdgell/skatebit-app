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
// Import the toast store for notifications.
import { toastStore } from "$lib/stores/toastStore";

// The baseFolder is relative to Documents.
export const baseFolder = "SkaterXL";

/**
 * Loads the contents of a folder (e.g. Documents/SkaterXL/Maps)
 * and returns entries that are either directories or files that do not have
 * disallowed image extensions. For non-directory files, stat() is used to attach
 * a `size` property (in bytes) to the entry.
 */
export async function loadLocalMapsSimple(
  mapsFolder: string
): Promise<DirEntry[]> {
  try {
    const entries = await readDir(mapsFolder, {
      baseDir: BaseDirectory.Document,
    });
    console.debug("readDir returned:", entries);

    // List of file extensions to filter out.
    const disallowedExts = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];

    // Filter out unwanted files, keeping directories.
    let filtered = entries.filter((entry) => {
      if (entry.isDirectory) return true;
      const lowerName = entry.name.toLowerCase();
      return !disallowedExts.some((ext) => lowerName.endsWith(ext));
    });

    // For each non-directory entry, retrieve file size via stat.
    filtered = await Promise.all(
      filtered.map(async (entry) => {
        if (!entry.isDirectory) {
          try {
            const filePath = await join(mapsFolder, entry.name);
            const statInfo = await stat(filePath, {
              baseDir: BaseDirectory.Document,
            });
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

/**
 * Loads all entries in the given directory (relative to Documents)
 * and attaches file sizes to non-directory entries.
 */
export async function loadEntries(currentPath: string): Promise<DirEntry[]> {
  try {
    const entries = await readDir(currentPath, {
      baseDir: BaseDirectory.Document,
    });

    // Enrich non-directory entries with file size.
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory) {
          try {
            const filePath = await join(currentPath, entry.name);
            const statInfo = await stat(filePath, {
              baseDir: BaseDirectory.Document,
            });
            (entry as any).size = statInfo.size;
            console.debug(`Entry "${entry.name}" size:`, statInfo.size);
          } catch (e) {
            console.error("Error retrieving stat for", entry.name, e);
          }
        }
        return entry;
      })
    );

    return enriched.sort((a, b) =>
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

/**
 * Opens a directory by appending the folder name to the current path.
 */
export async function openDirectory(
  currentPath: string,
  dirName: string
): Promise<string> {
  return normalizePath(`${currentPath}/${dirName}`);
}

/**
 * Returns the parent directory of the current path.
 */
export async function goUp(currentPath: string): Promise<string> {
  const normalized = normalizePath(currentPath);
  if (normalized === baseFolder) return normalized;
  return normalized.split("/").slice(0, -1).join("/");
}

/**
 * Prompts the user for a new folder name, then creates the folder.
 * Shows a toast notification upon success.
 */
export async function promptNewFolder(currentPath: string): Promise<void> {
  const folderName = prompt("Enter new folder name:");
  if (folderName) {
    try {
      await mkdir(normalizePath(`${currentPath}/${folderName}`), {
        baseDir: BaseDirectory.Document,
      });
      // Show a success toast using the alert-success variant.
      toastStore.addToast(
        `Folder "${folderName}" created successfully`,
        "alert-success",
        3000
      );
    } catch (error) {
      handleError(error, "creating new folder");
    }
  }
}

/**
 * Prompts the user for a new file name, then creates the file.
 * Shows a toast notification upon success.
 */
export async function promptNewFile(currentPath: string): Promise<void> {
  const fileName = prompt("Enter new file name:");
  if (fileName) {
    try {
      await create(normalizePath(`${currentPath}/${fileName}`), {
        baseDir: BaseDirectory.Document,
      });
      // Show a success toast using the alert-success variant.
      toastStore.addToast(
        `File "${fileName}" created successfully`,
        "alert-success",
        3000
      );
    } catch (err) {
      handleError(err, "creating new file");
    }
  }
}

/**
 * Prompts the user for a new name and renames an entry.
 * Shows a toast notification upon success.
 */
export async function renameEntry(
  currentPath: string,
  oldName: string
): Promise<void> {
  const newEntryName = prompt("New name:", oldName);
  if (!newEntryName) return;
  try {
    const oldPath = await join(currentPath, oldName);
    const newPath = await join(currentPath, newEntryName);
    await rename(oldPath, newPath);
    // Show a toast notification informing about the successful rename.
    toastStore.addToast(
      `Entry renamed successfully to "${newEntryName}"`,
      "alert-info",
      3000
    );
  } catch (error) {
    handleError(error, "renaming entry");
  }
}

/**
 * Prompts for confirmation and then deletes an entry.
 * Shows a toast notification upon success.
 */
export async function deleteEntry(
  currentPath: string,
  name: string
): Promise<boolean> {
  const confirmed = confirm(`Delete "${name}"? This action cannot be undone.`);
  if (!confirmed) return false;
  try {
    await remove(`${currentPath}/${name}`, {
      baseDir: BaseDirectory.Document,
      recursive: true,
    });
    // Show a toast notification using the alert-warning variant.
    toastStore.addToast(
      `Entry "${name}" deleted successfully`,
      "alert-warning",
      3000
    );
    return true;
  } catch (error) {
    handleError(error, "deleting entry");
    throw error;
  }
}

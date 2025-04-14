// src/lib/ts/dragDrop.ts
import { invoke } from "@tauri-apps/api/core";
import { documentDir, join, normalize } from "@tauri-apps/api/path";
import {
  readFile,
  writeFile,
  readDir,
  mkdir,
  stat,
  type DirEntry as TauriDirEntry,
  type FileInfo,
} from "@tauri-apps/plugin-fs";
import { handleError } from "../ts/errorHandler";
import { toastStore } from "$lib/stores/toastStore";
import { normalizePath, getFileName } from "$lib/ts/pathUtils";

export async function handleDroppedPaths(
  paths: string[],
  currentDestAbsolutePath: string // Expect absolute path now
): Promise<void> {
  let successCount = 0;
  let errorCount = 0;

  if (!currentDestAbsolutePath) {
    handleError(
      "Cannot handle drop: Destination path is invalid.",
      "File Drop"
    );
    return;
  }

  for (const sourcePath of paths) {
    const itemName = getFileName(sourcePath); // Use helper for consistency
    try {
      const info: FileInfo = await stat(sourcePath);
      const targetAbsolutePath = normalizePath(
        await join(currentDestAbsolutePath, itemName)
      ); // Target absolute path
      if (!targetAbsolutePath) {
        throw new Error("Could not construct target path.");
      }

      if (sourcePath.toLowerCase().endsWith(".zip")) {
        // Unzip requires the absolute path of the *parent* directory
        const parentDir = normalizePath(await join(targetAbsolutePath, ".."));
        if (!parentDir) {
          throw new Error(
            "Could not determine parent directory for unzipping."
          );
        }
        await mkdir(parentDir, { recursive: true });
        await invoke("unzip_file", {
          zipPath: sourcePath,
          mapsFolder: parentDir, // Pass absolute parent dir path
        });
        toastStore.addToast(`Unzipped "${itemName}"`, "alert-success");
        successCount++;
      } else if (info.isDirectory) {
        await copyFolderRecursive(sourcePath, targetAbsolutePath); // Pass absolute target
        successCount++;
      } else if (info.isFile) {
        await copySingleFile(sourcePath, targetAbsolutePath); // Pass absolute target
        successCount++;
      } else {
        console.warn(`Skipping unknown file type: ${sourcePath}`);
        toastStore.addToast(
          `Skipped unknown type: "${itemName}"`,
          "alert-warning"
        );
      }
    } catch (error) {
      errorCount++;
      handleError(error, `processing dropped path ${sourcePath}`);
    }
  }
  // Optional Summary Toast logic can remain here
}

// Renamed to avoid confusion with fs plugin's copyFile
export async function copySingleFile(
  sourcePath: string,
  targetAbsolutePath: string
): Promise<void> {
  const fileName = getFileName(sourcePath); // Use helper
  try {
    const fileData = await readFile(sourcePath);
    // writeFile needs absolute path, no BaseDirectory needed if path is absolute
    await writeFile(targetAbsolutePath, fileData /* Removed baseDir option */);
    console.log(`Copied file "${fileName}" to "${targetAbsolutePath}"`);
    toastStore.addToast(`Copied file: ${fileName}`, "alert-success");
  } catch (error) {
    handleError(error, `copying file ${fileName} to ${targetAbsolutePath}`);
    throw error; // Re-throw to be caught by handleDroppedPaths
  }
}

// Renamed to be clearer
export async function copyFolderRecursive(
  sourcePath: string,
  targetAbsolutePath: string
): Promise<void> {
  const folderName = getFileName(sourcePath); // Use helper
  try {
    // mkdir needs absolute path, no BaseDirectory needed if path is absolute
    await mkdir(targetAbsolutePath, { recursive: true });
    const items: TauriDirEntry[] = await readDir(sourcePath);

    for (const item of items) {
      const itemName = item.name;
      if (!itemName) continue; // Skip items without names

      const itemSourcePath = await join(sourcePath, itemName);
      const itemTargetPath = await join(targetAbsolutePath, itemName); // Construct absolute target for item

      if (item.isDirectory) {
        await copyFolderRecursive(itemSourcePath, itemTargetPath); // Recurse with absolute paths
      } else {
        await copySingleFile(itemSourcePath, itemTargetPath); // Copy file with absolute paths
      }
    }
    console.log(`Copied folder "${folderName}" to "${targetAbsolutePath}"`);
    toastStore.addToast(`Copied folder: ${folderName}`, "alert-success");
  } catch (error) {
    handleError(error, `copying folder ${folderName} to ${targetAbsolutePath}`);
    throw error; // Re-throw to be caught by handleDroppedPaths
  }
}

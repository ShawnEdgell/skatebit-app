import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import {
  readFile,
  writeFile,
  readDir,
  mkdir,
  stat,
  type DirEntry as TauriDirEntry,
  type FileInfo,
} from "@tauri-apps/plugin-fs";
import { handleError } from "$lib/utils/errorHandler";
import { toastStore } from "$lib/stores/uiStore";
import { normalizePath, getFileName } from "$lib/services/pathService";

export async function handleDroppedPaths(
  paths: string[],
  currentDestAbsolutePath: string // Expect absolute path
): Promise<void> {
  let successCount = 0;
  let errorCount = 0;

  // Ensure destination path is valid before starting loop
  if (
    !currentDestAbsolutePath ||
    currentDestAbsolutePath.startsWith("/error") ||
    currentDestAbsolutePath.trim() === ""
  ) {
    handleError(
      `Cannot handle drop: Destination path is invalid ('${currentDestAbsolutePath}').`,
      "File Drop"
    );
    return;
  }

  for (const sourcePath of paths) {
    const normSourcePath = normalizePath(sourcePath); // Normalize source path
    if (!normSourcePath) {
      console.warn(`Skipping drop for invalid source path: ${sourcePath}`);
      errorCount++;
      continue; // Skip this item
    }

    const itemName = getFileName(normSourcePath); // Get name from normalized path

    try {
      const info: FileInfo = await stat(normSourcePath);

      if (normSourcePath.toLowerCase().endsWith(".zip")) {
        console.log(`Processing dropped zip file: ${itemName}`);
        // Pass the intended *destination directory* to the Rust command
        await invoke("unzip_file", {
          zipPath: normSourcePath,
          // ---> FIX: Pass destination directory as target_base_folder <---
          targetBaseFolder: currentDestAbsolutePath,
        });
        toastStore.addToast(`Unzipped "${itemName}"`, "alert-success");
        successCount++;
      } else if (info.isDirectory) {
        console.log(`Processing dropped directory: ${itemName}`);
        const targetAbsolutePath = normalizePath(
          await join(currentDestAbsolutePath, itemName)
        );
        if (!targetAbsolutePath) {
          throw new Error(
            `Could not construct target path for directory ${itemName}.`
          );
        }
        await copyFolderRecursive(normSourcePath, targetAbsolutePath);
        successCount++;
      } else if (info.isFile) {
        console.log(`Processing dropped file: ${itemName}`);
        const targetAbsolutePath = normalizePath(
          await join(currentDestAbsolutePath, itemName)
        );
        if (!targetAbsolutePath) {
          throw new Error(
            `Could not construct target path for file ${itemName}.`
          );
        }
        await copySingleFile(normSourcePath, targetAbsolutePath);
        successCount++;
      } else {
        console.warn(`Skipping unknown file type: ${normSourcePath}`);
        toastStore.addToast(
          `Skipped unknown type: "${itemName}"`,
          "alert-warning"
        );
      }
    } catch (error) {
      errorCount++;
      // Pass normalized source path to error handler
      handleError(
        error,
        `processing dropped item ${itemName || normSourcePath}`
      );
    }
  }

  // Optional summary toast
  if (successCount > 0 && errorCount === 0) {
    // toastStore.addToast(`Successfully processed ${successCount} dropped item(s).`, "alert-info");
  } else if (successCount > 0 && errorCount > 0) {
    toastStore.addToast(
      `Processed ${successCount} item(s) with ${errorCount} error(s).`,
      "alert-warning"
    );
  } else if (errorCount > 0) {
    // Handled by individual errors, maybe no summary needed or a generic failure toast
  }
}

// Keep copySingleFile as is (looks okay)
export async function copySingleFile(
  sourcePath: string,
  targetAbsolutePath: string
): Promise<void> {
  const fileName = getFileName(sourcePath);
  try {
    console.log(
      `Copying file "${fileName}" from "${sourcePath}" to "${targetAbsolutePath}"`
    );
    const fileData = await readFile(sourcePath);
    // Ensure parent directory exists for the target file
    const parentDir =
      targetAbsolutePath.substring(0, targetAbsolutePath.lastIndexOf("/")) ||
      "/";
    if (parentDir !== "/") {
      // Avoid trying to create root
      await mkdir(parentDir, { recursive: true });
    }
    await writeFile(targetAbsolutePath, fileData);
    console.log(`Copied file "${fileName}" successfully.`);
    // Optional success toast here? Might be too noisy.
    // toastStore.addToast(`Copied file: ${fileName}`, "alert-success");
  } catch (error) {
    console.error(
      `Error copying file ${fileName} from ${sourcePath} to ${targetAbsolutePath}:`,
      error
    );
    // Re-throw to be caught by handleDroppedPaths
    throw error;
  }
}

// Keep copyFolderRecursive as is (looks okay)
export async function copyFolderRecursive(
  sourcePath: string,
  targetAbsolutePath: string
): Promise<void> {
  const folderName = getFileName(sourcePath);
  try {
    console.log(
      `Copying folder "${folderName}" from "${sourcePath}" to "${targetAbsolutePath}"`
    );
    // Create the target directory first
    await mkdir(targetAbsolutePath, { recursive: true });
    const items: TauriDirEntry[] = await readDir(sourcePath);

    for (const item of items) {
      const itemName = item.name;
      if (!itemName) {
        console.warn(`Skipping item with no name inside ${sourcePath}`);
        continue;
      }

      // Construct full paths for source and target items
      const itemSourcePath = await join(sourcePath, itemName);
      const itemTargetPath = await join(targetAbsolutePath, itemName);

      // Check if item is a directory (TauriDirEntry might not have isDirectory directly)
      // Need to stat again or rely on name not having extension (less reliable)
      // Or assume TauriDirEntry provides type info if possible
      let isItemDirectory = false;
      if (item.isDirectory !== undefined) {
        // If Tauri provides it directly
        isItemDirectory = item.isDirectory;
      } else {
        // Fallback: Stat the item to check if it's a directory
        try {
          const itemInfo = await stat(itemSourcePath);
          isItemDirectory = itemInfo.isDirectory;
        } catch (statError) {
          console.error(
            `Could not stat item ${itemSourcePath} during recursive copy:`,
            statError
          );
          continue; // Skip item if stat fails
        }
      }

      if (isItemDirectory) {
        await copyFolderRecursive(itemSourcePath, itemTargetPath);
      } else {
        // It's a file
        await copySingleFile(itemSourcePath, itemTargetPath);
      }
    }
    console.log(`Copied folder "${folderName}" successfully.`);
    // Optional success toast here? Might be too noisy.
    // toastStore.addToast(`Copied folder: ${folderName}`, "alert-success");
  } catch (error) {
    console.error(
      `Error copying folder ${folderName} from ${sourcePath} to ${targetAbsolutePath}:`,
      error
    );
    // Re-throw to be caught by handleDroppedPaths
    throw error;
  }
}

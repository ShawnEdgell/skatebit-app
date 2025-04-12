// src/lib/ts/dragDrop.ts
import { invoke } from "@tauri-apps/api/core";
import { documentDir, join, normalize } from "@tauri-apps/api/path";
import {
  readFile,
  writeFile,
  readDir,
  mkdir,
  stat,
  BaseDirectory,
  type DirEntry as TauriDirEntry,
  type FileInfo,
} from "@tauri-apps/plugin-fs";
import { handleError } from "../ts/errorHandler";
import { toastStore } from "$lib/stores/toastStore";
import { normalizePath } from "$lib/ts/pathUtils";

async function getTargetPath(
  destRelativeDir: string,
  fileName: string
): Promise<string> {
  const docDir = await documentDir();
  return normalize(await join(docDir, destRelativeDir, fileName));
}

export async function handleDroppedPaths(
  paths: string[],
  currentDestRelativePath: string
): Promise<void> {
  // Add a counter for overall success message?
  let successCount = 0;
  let errorCount = 0;

  for (const sourcePath of paths) {
    const itemName = sourcePath.split(/[\\/]/).pop() || "item"; // Get name for messages
    try {
      const info: FileInfo = await stat(sourcePath);

      if (sourcePath.toLowerCase().endsWith(".zip")) {
        const absoluteTargetPath = await getTargetPath(
          currentDestRelativePath,
          ""
        );
        await mkdir(absoluteTargetPath, { recursive: true });
        await invoke("unzip_file", {
          zipPath: sourcePath,
          mapsFolder: absoluteTargetPath,
        });
        toastStore.addToast(`Unzipped "${itemName}"`, "alert-success"); // Keep zip toast here
        successCount++;
      } else if (info.isDirectory) {
        await copyFolder(sourcePath, currentDestRelativePath); // copyFolder will show toast now
        successCount++;
      } else if (info.isFile) {
        await copyFile(sourcePath, currentDestRelativePath); // copyFile will show toast now
        successCount++;
      } else {
        console.warn(`Skipping unknown file type: ${sourcePath}`);
        toastStore.addToast(
          `Skipped unknown type: "${itemName}"`,
          "alert-warning"
        );
        // Doesn't count as success or error? Or maybe error?
      }
    } catch (error) {
      errorCount++; // Increment error count
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // Toast is already shown in the catch block, just make sure handleError doesn't duplicate it
      // toastStore.addToast(`Error processing "${itemName}": ${errorMessage}`, "alert-error"); // Already handled below
      handleError(error, `processing dropped path ${sourcePath}`);
    }
  }

  // Optional: Add a summary toast?
  // if (errorCount === 0 && successCount > 0) {
  //    toastStore.addToast(`Successfully processed ${successCount} items.`, "alert-info");
  // } else if (successCount > 0 && errorCount > 0) {
  //    toastStore.addToast(`Processed ${successCount} items with ${errorCount} errors.`, "alert-warning");
  // }

  // TODO: Refresh explorerStore after completion?
  // import { explorerStore } from '$lib/stores/explorerStore';
  // await explorerStore.refresh(); // Await refresh here
}

export async function copyFile(
  sourcePath: string,
  destRelativeDir: string
): Promise<void> {
  const fileName = sourcePath.split(/[\\/]/).pop();
  if (!fileName) {
    throw new Error(`Could not determine filename from source: ${sourcePath}`);
  }

  try {
    const fileData = await readFile(sourcePath);
    const targetRelativePath = normalizePath(
      await join(destRelativeDir, fileName)
    );
    await writeFile(targetRelativePath, fileData, {
      baseDir: BaseDirectory.Document,
    });
    console.log(`Copied file "${fileName}" to "${destRelativeDir}"`);
    // *** ADD Toast for successful file copy ***
    toastStore.addToast(`Copied file: ${fileName}`, "alert-success");
  } catch (error) {
    // Error handling is already here, re-throw to be caught by handleDroppedPaths
    handleError(error, `copying file ${fileName} to ${destRelativeDir}`);
    throw error;
  }
}

export async function copyFolder(
  sourcePath: string,
  destRelativeDir: string
): Promise<void> {
  const folderName = sourcePath.split(/[\\/]/).pop();
  if (!folderName) {
    throw new Error(
      `Could not determine folder name from source: ${sourcePath}`
    );
  }

  try {
    const targetFolderRelative = normalizePath(
      await join(destRelativeDir, folderName)
    );
    await mkdir(targetFolderRelative, {
      baseDir: BaseDirectory.Document,
      recursive: true,
    });
    const items: TauriDirEntry[] = await readDir(sourcePath);

    for (const item of items) {
      const itemName = item.name;
      if (!itemName) {
        console.warn("Skipping item with missing name:", item);
        continue;
      }
      const itemSourcePath = await join(sourcePath, itemName);
      if (item.isDirectory) {
        await copyFolder(itemSourcePath, targetFolderRelative);
      } else {
        await copyFile(itemSourcePath, targetFolderRelative);
      }
    }
    console.log(`Copied folder "${folderName}" to "${destRelativeDir}"`);
    // *** ADD Toast for successful folder copy (after recursion finishes) ***
    toastStore.addToast(`Copied folder: ${folderName}`, "alert-success");
  } catch (error) {
    handleError(error, `copying folder ${folderName} to ${destRelativeDir}`);
    throw error;
  }
}

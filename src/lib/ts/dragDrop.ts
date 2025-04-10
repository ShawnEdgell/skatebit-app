// src/lib/dragDrop.ts
import { invoke } from "@tauri-apps/api/core";
import { documentDir, join } from "@tauri-apps/api/path"; // Keep join
import {
  readFile,
  writeFile,
  readDir,
  mkdir,
  stat,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { handleError } from "./errorHandler";
import { toastStore } from "$lib/stores/toastStore";

// copyFile and copyFolder remain the same...

export async function handleDroppedPaths(
  paths: string[],
  currentPath: string // This is relative to documentDir
): Promise<void> {
  for (const p of paths) {
    try {
      console.log("Dropped path detected:", p); // e.g., /Users/you/Downloads/archive.zip
      console.log("Target relative path:", currentPath); // e.g., "MyProject/Subfolder"

      if (p.toLowerCase().endsWith(".zip")) {
        // Calculate the absolute target directory path
        const docDir = await documentDir();
        const absoluteTargetPath = await join(docDir, currentPath); // e.g., /Users/you/Documents/MyProject/Subfolder

        console.log(
          `Invoking unzip_file: zipPath=${p}, targetDir=${absoluteTargetPath}`
        );

        // Pass the absolute path to the Rust command
        await invoke("unzip_file", {
          zipPath: p, // The absolute path of the zip file itself
          targetDir: absoluteTargetPath, // The absolute path where contents should go
        });

        toastStore.addToast(
          `Unzipped "${p
            .split(/[\\/]/)
            .pop()}" successfully into "${currentPath}".`, // User-friendly message
          "alert-success",
          3000
        );
      } else {
        const info = await stat(p);
        if (info.isDirectory) {
          await copyFolder(p, currentPath); // copyFolder already resolves paths correctly relative to docDir
        } else {
          await copyFile(p, currentPath); // copyFile already resolves paths correctly relative to docDir
        }
      }
    } catch (error) {
      handleError(error, `processing dropped path ${p}`);
    }
  }
}

// --- Keep copyFile and copyFolder as they are ---
export async function copyFile(
  source: string,
  destRelativeDir: string
): Promise<void> {
  try {
    console.log("Copying file:", source);
    const fileData = await readFile(source); // Read from absolute source path
    const fileName = source.split(/[\\/]/).pop();
    if (!fileName) return;
    const docDir = await documentDir();
    // Construct absolute destination path using join and Document base directory
    const targetPath = await join(docDir, destRelativeDir, fileName);
    console.log(`Attempting to write to: ${targetPath}`);
    // Use the absolute path for writing - writeFile with BaseDirectory handles this implicitly if path is absolute
    // Or explicitly don't provide baseDir if targetPath is absolute: await writeFile(targetPath, fileData);
    // Using BaseDirectory.Document and a relative path derived from join might be safer:
    const finalRelativeDest = await join(destRelativeDir, fileName);
    await writeFile(finalRelativeDest, fileData, {
      baseDir: BaseDirectory.Document,
    });

    console.log(`Copied file from ${source} to ${targetPath}`);
    toastStore.addToast(
      `Copied file "${fileName}" successfully.`,
      "alert-success",
      3000
    );
  } catch (error) {
    handleError(error, `processing dropped file ${source}`);
  }
}

export async function copyFolder(
  source: string,
  destRelativeDir: string
): Promise<void> {
  try {
    console.log("Copying folder:", source);
    const folderName = source.split(/[\\/]/).pop();
    if (!folderName) return;
    const docDir = await documentDir();
    const targetFolderRelative = await join(destRelativeDir, folderName);
    // Create directory relative to Document base dir
    await mkdir(targetFolderRelative, {
      baseDir: BaseDirectory.Document,
      recursive: true,
    }); // Add recursive: true

    const items = await readDir(source); // Read absolute source path
    for (const item of items) {
      // Construct absolute path for the item inside the source folder
      // Note: tauri path.join works correctly across platforms for combining paths
      const itemSourcePath = await join(source, item.name || ""); // Use Tauri join for source path construction too

      if (item.isDirectory) {
        // Pass the new relative destination dir for recursion
        await copyFolder(itemSourcePath, targetFolderRelative);
      } else if (item.isFile) {
        // Check if it's a file
        // Pass the relative destination directory for copyFile
        await copyFile(itemSourcePath, targetFolderRelative);
      }
    }
    const absoluteTargetFolder = await join(docDir, targetFolderRelative);
    console.log(`Copied folder ${source} to ${absoluteTargetFolder}`);
    toastStore.addToast(
      `Copied folder "${folderName}" successfully.`,
      "alert-success",
      3000
    );
  } catch (error) {
    handleError(error, `processing dropped folder ${source}`);
  }
}

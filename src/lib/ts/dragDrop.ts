import { invoke } from "@tauri-apps/api/core";
import { documentDir, join } from "@tauri-apps/api/path";
import {
  readFile,
  writeFile,
  readDir,
  mkdir,
  stat,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { handleError } from "./errorHandler";
import { showToast } from "../utils/toastUtils";

// Helper function to get the target path for copying files/folders
async function getTargetPath(destRelativeDir: string, fileName: string) {
  const docDir = await documentDir();
  return join(docDir, destRelativeDir, fileName);
}

export async function handleDroppedPaths(
  paths: string[],
  currentPath: string
): Promise<void> {
  for (const p of paths) {
    try {
      if (p.toLowerCase().endsWith(".zip")) {
        const absoluteTargetPath = await getTargetPath(currentPath, "");

        await invoke("unzip_file", {
          zipPath: p,
          targetDir: absoluteTargetPath,
        });

        showToast(
          `Unzipped "${p
            .split(/[\\/]/)
            .pop()}" successfully into "${currentPath}".`,
          "alert-success",
          3000
        );
      } else {
        const info = await stat(p);
        if (info.isDirectory) {
          await copyFolder(p, currentPath);
        } else {
          await copyFile(p, currentPath);
        }
      }
    } catch (error) {
      handleError(error, `processing dropped path ${p}`);
    }
  }
}

export async function copyFile(
  source: string,
  destRelativeDir: string
): Promise<void> {
  try {
    const fileName = source.split(/[\\/]/).pop();
    if (!fileName) return;

    const targetPath = await getTargetPath(destRelativeDir, fileName);
    const fileData = await readFile(source);

    await writeFile(targetPath, fileData, { baseDir: BaseDirectory.Document });

    showToast(`Copied file "${fileName}" successfully.`, "alert-success", 3000);
  } catch (error) {
    handleError(error, `processing dropped file ${source}`);
  }
}

export async function copyFolder(
  source: string,
  destRelativeDir: string
): Promise<void> {
  try {
    const folderName = source.split(/[\\/]/).pop();
    if (!folderName) return;

    const targetFolderRelative = await join(destRelativeDir, folderName);
    await mkdir(targetFolderRelative, {
      baseDir: BaseDirectory.Document,
      recursive: true,
    });

    const items = await readDir(source);
    for (const item of items) {
      const itemSourcePath = await join(source, item.name || "");
      if (item.isDirectory) {
        await copyFolder(itemSourcePath, targetFolderRelative);
      } else if (item.isFile) {
        await copyFile(itemSourcePath, targetFolderRelative);
      }
    }

    showToast(
      `Copied folder "${folderName}" successfully.`,
      "alert-success",
      3000
    );
  } catch (error) {
    handleError(error, `processing dropped folder ${source}`);
  }
}

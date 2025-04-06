// src/lib/fsOperations.ts
import { documentDir, join } from "@tauri-apps/api/path";
import {
  readDir,
  BaseDirectory,
  create,
  mkdir,
  rename,
  remove,
  stat,
} from "@tauri-apps/plugin-fs";
import type { DirEntry } from "@tauri-apps/plugin-fs";

export const baseFolder = "SkaterXL";

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
    console.error("Failed to read directory:", error);
    return [];
  }
}

export async function openDirectory(
  currentPath: string,
  dirName: string
): Promise<string> {
  return `${currentPath}/${dirName}`;
}

export async function goUp(currentPath: string): Promise<string> {
  if (currentPath === baseFolder) return currentPath;
  return currentPath.split("/").slice(0, -1).join("/");
}

export async function promptNewFolder(currentPath: string): Promise<void> {
  const folderName = prompt("Enter new folder name:");
  if (folderName) {
    await mkdir(`${currentPath}/${folderName}`, {
      baseDir: BaseDirectory.Document,
    });
  }
}

export async function promptNewFile(currentPath: string): Promise<void> {
  const fileName = prompt("Enter new file name:");
  if (fileName) {
    try {
      await create(`${currentPath}/${fileName}`, {
        baseDir: BaseDirectory.Document,
      });
    } catch (err) {
      console.error("Failed to create file:", err);
    }
  }
}

export async function renameEntry(
  currentPath: string,
  oldName: string
): Promise<void> {
  const newEntryName = prompt("New name:", oldName);
  if (!newEntryName) return;
  const oldPath = await join(currentPath, oldName);
  const newPath = await join(currentPath, newEntryName);
  await rename(oldPath, newPath);
}

export async function deleteEntry(
  currentPath: string,
  name: string
): Promise<void> {
  if (confirm(`Delete "${name}"? This action can't be undone.`)) {
    await remove(`${currentPath}/${name}`, {
      baseDir: BaseDirectory.Document,
      recursive: true,
    });
  }
}

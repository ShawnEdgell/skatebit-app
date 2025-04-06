// src/lib/dragDrop.ts
import { documentDir, join } from "@tauri-apps/api/path";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { readDir, mkdir, stat } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/plugin-fs";

export async function copyFile(source: string, destDir: string): Promise<void> {
  try {
    console.log("Dropped file detected:", source);
    const fileData = await readFile(source);
    const fileName = source.split(/[\\/]/).pop();
    if (!fileName) return;
    const docDir = await documentDir();
    const targetPath = await join(docDir, destDir, fileName);
    await writeFile(targetPath, fileData, { baseDir: BaseDirectory.Document });
    console.log(`Copied file from ${source} to ${targetPath}`);
  } catch (error) {
    console.error("Error processing dropped file", source, error);
  }
}

export async function copyFolder(
  source: string,
  destDir: string
): Promise<void> {
  console.log("Dropped folder detected:", source);
  const folderName = source.split(/[\\/]/).pop();
  if (!folderName) return;
  const docDir = await documentDir();
  const targetFolder = await join(docDir, destDir, folderName);
  await mkdir(targetFolder, { baseDir: BaseDirectory.Document }).catch(
    () => {}
  );
  const items = await readDir(source);
  const newDestDir = await join(destDir, folderName);
  for (const item of items) {
    const itemSourcePath = `${source}/${item.name}`;
    if (item.isDirectory) {
      await copyFolder(itemSourcePath, newDestDir);
    } else {
      await copyFile(itemSourcePath, newDestDir);
    }
  }
  console.log(`Copied folder ${source} to ${targetFolder}`);
}

export async function handleDroppedPaths(
  paths: string[],
  currentPath: string
): Promise<void> {
  for (const p of paths) {
    try {
      console.log("Dropped path detected:", p);
      const info = await stat(p);
      if (info.isDirectory) {
        await copyFolder(p, currentPath);
      } else {
        await copyFile(p, currentPath);
      }
    } catch (error) {
      console.error("Error processing dropped path", p, error);
    }
  }
}

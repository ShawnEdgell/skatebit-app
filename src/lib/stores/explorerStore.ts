// src/lib/stores/explorerStore.ts
import { writable, get, type Writable } from "svelte/store";
import { documentDir, normalize, join } from "@tauri-apps/api/path";
import { normalizePath } from "$lib/ts/pathUtils";
import { handleError } from "$lib/ts/errorHandler";
import {
  type FsEntry,
  type DirectoryListingResult,
  ListingStatus,
  loadDirectoryEntries,
  createDirectoryFs,
  createFileFs,
  renameEntryFs,
  deleteEntryFs,
  baseFolder,
} from "$lib/ts/fsOperations";

export const entries = writable<FsEntry[]>([]);
export const currentPath = writable<string>("");
export const isLoading = writable<boolean>(true);
export const directoryStatus = writable<ListingStatus | null>(null);

let absoluteBaseFolderPath: string = "";

export async function refresh(pathOverride?: string): Promise<void> {
  const path = normalizePath(pathOverride ?? get(currentPath)); // Normalize path before using
  if (!path) {
    isLoading.set(false);
    return;
  }
  isLoading.set(true);
  directoryStatus.set(null);
  entries.set([]);
  try {
    const result = await loadDirectoryEntries(path); // path is now guaranteed string
    entries.set(result.entries);
    directoryStatus.set(result.status);
    currentPath.set(result.path); // Set normalized path from result
  } catch (err) {
    handleError(err, `Store refreshing path ${path}`); // path is string here
    directoryStatus.set(null);
  } finally {
    isLoading.set(false);
  }
}

export async function setPath(newAbsolutePath: string | null): Promise<void> {
  // Allow null input
  await refresh(newAbsolutePath ?? undefined); // Pass undefined if null
}

export async function openDirectory(name: string): Promise<void> {
  const dirEntry = get(entries).find((e) => e.name === name && e.isDirectory);
  if (dirEntry?.path) await refresh(dirEntry.path);
}

export async function goUp(): Promise<void> {
  const currentAbsPath = get(currentPath);
  if (!absoluteBaseFolderPath || currentAbsPath === absoluteBaseFolderPath)
    return;
  const parentAbsPath = normalizePath(await join(currentAbsPath, "..")); // path is guaranteed string | null
  // Check parentAbsPath is not null before proceeding
  if (
    absoluteBaseFolderPath &&
    parentAbsPath &&
    parentAbsPath.startsWith(absoluteBaseFolderPath)
  ) {
    await refresh(parentAbsPath); // pass string | null
  } else {
    await refresh(absoluteBaseFolderPath); // pass string
  }
}

export async function createDirectory(
  absolutePathToCreate: string
): Promise<void> {
  try {
    const normalizedCreatePath = normalizePath(absolutePathToCreate);
    if (!normalizedCreatePath)
      throw new Error("Invalid path provided for directory creation.");
    await createDirectoryFs(normalizedCreatePath);
    const parentPath = normalizePath(await join(normalizedCreatePath, ".."));
    if (normalizePath(get(currentPath)) === parentPath) await refresh();
  } catch (error) {
    handleError(error, `Store creating directory ${absolutePathToCreate}`);
    throw error;
  }
}

export async function newFolder(folderName: string): Promise<void> {
  const parentAbsPath = get(currentPath);
  if (!parentAbsPath) {
    handleError("Cannot create folder: current path is invalid.", "New Folder");
    return;
  }
  const newDirPath = await join(parentAbsPath, folderName);
  try {
    await createDirectoryFs(newDirPath);
    await refresh();
  } catch (error) {
    handleError(error, `Store creating folder ${folderName}`);
    throw error;
  }
}

export async function newFile(fileName: string): Promise<void> {
  const parentAbsPath = get(currentPath);
  if (!parentAbsPath) {
    handleError("Cannot create file: current path is invalid.", "New File");
    return;
  }
  const newFilePath = await join(parentAbsPath, fileName);
  try {
    await createFileFs(newFilePath);
    await refresh();
  } catch (error) {
    handleError(error, `Store creating file ${fileName}`);
    throw error;
  }
}

export async function rename(oldName: string, newName: string): Promise<void> {
  if (!newName || oldName === newName) return;
  const parentAbsPath = get(currentPath);
  if (!parentAbsPath) {
    handleError("Cannot rename: current path is invalid.", "Rename");
    return;
  }
  const oldAbsPath = await join(parentAbsPath, oldName);
  const newAbsPath = await join(parentAbsPath, newName);
  try {
    await renameEntryFs(oldAbsPath, newAbsPath);
    await refresh();
  } catch (error) {
    handleError(error, `Store renaming ${oldName} to ${newName}`);
    throw error;
  }
}

export async function deleteEntry(name: string): Promise<void> {
  const parentAbsPath = get(currentPath);
  if (!parentAbsPath) {
    handleError("Cannot delete: current path is invalid.", "Delete");
    return;
  }
  const absPathToDelete = await join(parentAbsPath, name);
  try {
    await deleteEntryFs(absPathToDelete);
    await refresh();
  } catch (error) {
    handleError(error, `Store deleting ${name}`);
    throw error;
  }
}

export function getAbsoluteBaseFolderPath(): string {
  return absoluteBaseFolderPath;
}

async function initialize() {
  try {
    const docDir = await documentDir();
    const calculatedBasePath = normalizePath(
      await normalize(await join(docDir, baseFolder))
    );
    if (!calculatedBasePath) {
      throw new Error("Default base path resolved to null");
    }
    absoluteBaseFolderPath = calculatedBasePath; // Assign the guaranteed string
    console.log(
      `[Store Initialize] absoluteBaseFolderPath set to: ${absoluteBaseFolderPath}`
    );
    await refresh(absoluteBaseFolderPath);
  } catch (e) {
    handleError(e, "Explorer Initialization");
    currentPath.set("/error/init");
    absoluteBaseFolderPath = "";
    isLoading.set(false);
  }
}

initialize();

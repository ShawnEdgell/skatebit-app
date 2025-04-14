// src/lib/stores/explorerStore.ts
import {
  writable,
  get,
  readable,
  type Writable,
  type Readable,
} from "svelte/store";
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

let internalSetBasePath: (value: string) => void = () => {};
export const absoluteBaseFolderPath: Readable<string> = readable("", (set) => {
  internalSetBasePath = set;
  return () => {
    internalSetBasePath = () => {};
  };
});

let storeInitializationStarted = false;

export async function refresh(pathOverride?: string): Promise<void> {
  const path = normalizePath(pathOverride ?? get(currentPath));
  if (!path) {
    isLoading.set(false);
    return;
  }
  isLoading.set(true);
  directoryStatus.set(null);
  entries.set([]);
  try {
    const result = await loadDirectoryEntries(path);
    entries.set(result.entries);
    directoryStatus.set(result.status);
    currentPath.set(result.path);
  } catch (err) {
    handleError(err, `Store refreshing path ${path}`);
    directoryStatus.set(null);
  } finally {
    isLoading.set(false);
  }
}

export async function setPath(newAbsolutePath: string | null): Promise<void> {
  await refresh(newAbsolutePath ?? undefined);
}

export async function openDirectory(name: string): Promise<void> {
  const dirEntry = get(entries).find((e) => e.name === name && e.isDirectory);
  if (dirEntry?.path) await refresh(dirEntry.path);
}

export async function goUp(): Promise<void> {
  const currentAbsPath = get(currentPath);
  const baseAbsPath = get(absoluteBaseFolderPath);
  if (!baseAbsPath || currentAbsPath === baseAbsPath) return;
  const parentAbsPath = normalizePath(await join(currentAbsPath, ".."));
  if (baseAbsPath && parentAbsPath && parentAbsPath.startsWith(baseAbsPath)) {
    await refresh(parentAbsPath);
  } else {
    await refresh(baseAbsPath);
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

async function initializeStore() {
  if (storeInitializationStarted) return;
  storeInitializationStarted = true;
  isLoading.set(true);
  try {
    const docDir = await documentDir();
    const calculatedBasePath = normalizePath(
      await normalize(await join(docDir, baseFolder))
    );
    if (!calculatedBasePath) {
      throw new Error("Default base path resolved to null/empty");
    }
    internalSetBasePath(calculatedBasePath);
    console.log(
      `[Store Initialize] absoluteBaseFolderPath store set to: ${calculatedBasePath}`
    );
    await refresh(calculatedBasePath);
  } catch (e) {
    handleError(e, "Explorer Store Initialization");
    internalSetBasePath("/error/basepath");
    currentPath.set("/error/init");
    isLoading.set(false);
  }
}

export { initializeStore as initializeExplorerStore };

// Removed getAbsoluteBaseFolderPath export
// Removed automatic initialize() call

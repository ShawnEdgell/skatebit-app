// src/lib/stores/explorerStore.ts
import { writable, get } from "svelte/store";
import type { FsEntry } from "$lib/ts/fsOperations";
import {
  loadEntries,
  baseFolder, // Initial relative base folder
  // openDirectory, // Not used directly anymore
  // goUp, // Not used directly anymore
  createFolder,
  createFile,
  renameEntry,
  deleteEntry,
} from "$lib/ts/fsOperations";
import { documentDir, normalize, join } from "@tauri-apps/api/path"; // Import path utils
import { normalizePath } from "$lib/ts/pathUtils"; // Your helper
import { handleError } from "$lib/ts/errorHandler"; // Import error handler

// Helper to get Document Dir (cached)
let documentDirPath: string | null = null;
async function getDocumentDir(): Promise<string> {
  if (!documentDirPath) {
    documentDirPath = normalizePath(await documentDir());
  }
  return documentDirPath;
}

// Helper to calculate relative path safely
async function getRelativePathForCommand(
  absolutePath: string
): Promise<string | null> {
  try {
    const docDir = await getDocumentDir();
    const normalizedAbsPath = normalizePath(absolutePath);
    const normalizedDocDir = normalizePath(docDir); // Normalize once

    // Ensure it's inside the document directory and get the part after it
    if (normalizedAbsPath.startsWith(normalizedDocDir)) {
      let relPath = normalizedAbsPath.substring(normalizedDocDir.length);

      // Remove leading slash if present
      relPath = relPath.replace(/^[\/\\]/, ""); // Handles both / and \

      // Use '.' for the document directory itself
      relPath = relPath === "" ? "." : relPath;

      // We don't need to check for '..' because startsWith already confirmed it's inside
      return normalizePath(relPath); // Return normalized relative path
    } else {
      throw new Error(
        `Path "${absolutePath}" is not inside document directory "${docDir}".`
      );
    }
  } catch (error) {
    handleError(error, `Calculating relative path for ${absolutePath}`);
    return null;
  }
}

function createExplorerStore() {
  const entries = writable<FsEntry[]>([]);
  // Store absolute path internally, initialize asynchronously
  const currentPath = writable<string>(""); // Start empty, init in onMount effectively
  const isLoading = writable<boolean>(true); // Start loading true until initialized
  let absoluteBaseFolderPath: string = ""; // Store absolute base path

  async function refresh() {
    const path = get(currentPath);
    if (!path) {
      console.warn("ExplorerStore: Skipping refresh, currentPath is not set.");
      entries.set([]);
      isLoading.set(false);
      return;
    } // Don't refresh if path isn't initialized

    isLoading.set(true);
    try {
      // loadEntries now expects absolute path
      const data: FsEntry[] = await loadEntries(path);
      entries.set(data);
    } catch (err) {
      console.error("Error loading entries:", err);
      entries.set([]);
    } finally {
      isLoading.set(false);
    }
  }

  async function initialize() {
    try {
      const docDir = await getDocumentDir();
      absoluteBaseFolderPath = normalizePath(await join(docDir, baseFolder));
      console.log(
        "ExplorerStore Initializing: Base Folder Path =",
        absoluteBaseFolderPath
      );
      currentPath.set(absoluteBaseFolderPath); // Set initial path
      await refresh(); // Perform initial load
    } catch (e) {
      console.error("Failed to initialize explorer path:", e);
      handleError(e, "Explorer Initialization");
      currentPath.set("/error/failed/to/init"); // Indicate error path
      entries.set([]);
      isLoading.set(false);
    }
  }

  // Call initialize when store is created
  initialize();

  return {
    subscribe: entries.subscribe,
    entries,
    currentPath, // Exposes the store with the ABSOLUTE path
    isLoading,
    absoluteBaseFolderPath: () => absoluteBaseFolderPath, // Function to get base path if needed
    refresh,
    setPath: async (newAbsolutePath: string) => {
      // Basic validation might be good here
      currentPath.set(normalizePath(newAbsolutePath));
      await refresh();
    },
    openDirectory: async (name: string) => {
      const currentEntries = get(entries);
      const dirEntry = currentEntries.find(
        (e) => e.name === name && e.isDirectory
      );
      if (!dirEntry) {
        console.error(`Directory ${name} not found in current entries.`);
        return;
      }
      // path from FsEntry is already absolute
      currentPath.set(dirEntry.path);
      await refresh();
    },
    goUp: async () => {
      const currentAbsPath = get(currentPath);
      // Prevent going above the absolute base folder path
      if (
        currentAbsPath === absoluteBaseFolderPath ||
        !absoluteBaseFolderPath
      ) {
        console.log("Cannot go up further.");
        return;
      }

      const parts = currentAbsPath.split("/");
      if (parts.length <= 1) return; // Should not happen if check above works
      const parentAbsPath = parts.slice(0, -1).join("/") || "/";

      // Extra check to ensure we don't accidentally go above base
      if (
        absoluteBaseFolderPath &&
        !parentAbsPath.startsWith(absoluteBaseFolderPath) &&
        parentAbsPath !==
          absoluteBaseFolderPath.substring(
            0,
            absoluteBaseFolderPath.lastIndexOf("/")
          )
      ) {
        console.warn(
          "Attempted to navigate above base folder. Staying at:",
          absoluteBaseFolderPath
        );
        currentPath.set(absoluteBaseFolderPath); // Reset to base if navigation goes wrong
      } else {
        currentPath.set(parentAbsPath);
      }
      await refresh();
    },
    // CRUD operations calculate relative path needed for fsOperations/Rust commands
    newFolder: async (folderName: string) => {
      const parentAbsPath = get(currentPath);
      const relativePathForCommand = await getRelativePathForCommand(
        parentAbsPath
      );
      if (relativePathForCommand === null) return; // Error handled in helper
      await createFolder(relativePathForCommand, folderName); // createFolder expects parent relative path
      await refresh();
    },
    newFile: async (fileName: string) => {
      const parentAbsPath = get(currentPath);
      const relativePathForCommand = await getRelativePathForCommand(
        parentAbsPath
      );
      if (relativePathForCommand === null) return;
      await createFile(relativePathForCommand, fileName); // createFile expects parent relative path
      await refresh();
    },
    rename: async (oldName: string, newName: string) => {
      const parentAbsPath = get(currentPath);
      const relativePathForCommand = await getRelativePathForCommand(
        parentAbsPath
      );
      if (relativePathForCommand === null) return;
      await renameEntry(relativePathForCommand, oldName, newName); // renameEntry expects parent relative path
      await refresh();
    },
    delete: async (name: string) => {
      const parentAbsPath = get(currentPath);
      const relativePathForCommand = await getRelativePathForCommand(
        parentAbsPath
      );
      if (relativePathForCommand === null) return;
      await deleteEntry(relativePathForCommand, name); // deleteEntry expects parent relative path
      await refresh();
    },
  };
}

export const explorerStore = createExplorerStore();

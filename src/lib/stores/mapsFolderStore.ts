import { writable, get as getStoreValue, type Writable } from "svelte/store";
import { Store } from "@tauri-apps/plugin-store";
import { documentDir, normalize, join } from "@tauri-apps/api/path";
import { normalizePath } from "$lib/ts/pathUtils"; // Ensure this returns string | null
import { handleError } from "$lib/ts/errorHandler";

const DEFAULT_MAPS_PATH = "SkaterXL/Maps";
const SETTINGS_KEY = "mapsFolder";
const STORE_FILENAME = ".settings.dat";

// @ts-expect-error Constructor is public
const settingsStore = new Store(STORE_FILENAME);

const createMapsFolderStore = () => {
  // --- FIX: Initialize Writable with string | null ---
  const store = writable<string | null>(null); // Initialize as null, not undefined
  // --- END FIX ---
  const { subscribe, set: setStoreValue } = store;
  let isLoading = writable<boolean>(false);
  let hasAttemptedLoad = false;
  let initializationPromise: Promise<string | null> | null = null; // Promise resolves with the value

  async function loadValueIfNeeded(): Promise<string | null> {
    // Return existing promise if initialization is already running
    if (initializationPromise) return initializationPromise;
    // If already loaded (value is not undefined - changed back to null check), return current value
    if (getStoreValue(store) !== null && hasAttemptedLoad)
      return getStoreValue(store);
    // Prevent multiple loads if value is already set but flag is false (edge case)
    if (hasAttemptedLoad) return getStoreValue(store);

    initializationPromise = (async (): Promise<string | null> => {
      // Ensure return type matches
      hasAttemptedLoad = true;
      isLoading.set(true);
      console.log(
        "[mapsFolderStore] First access: attempting to load value..."
      );

      let pathValue: string | null = null;
      let defaultAbsPath: string | null = null;

      try {
        const docDir = await documentDir();
        defaultAbsPath = normalizePath(
          await normalize(await join(docDir, DEFAULT_MAPS_PATH))
        );
        if (!defaultAbsPath) throw new Error("Default path resolved to null");
      } catch (e) {
        handleError(e, "Calculating default maps path");
        defaultAbsPath = "/error/cannot/resolve/default/path";
      }

      try {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const loadedValue = await settingsStore.get<string | null>(
          SETTINGS_KEY
        );
        pathValue = loadedValue ?? null;

        if (!pathValue) {
          pathValue = defaultAbsPath;
          if (pathValue && !pathValue.startsWith("/error/")) {
            try {
              await settingsStore.set(SETTINGS_KEY, pathValue);
              await settingsStore.save();
            } catch (saveErr) {
              handleError(saveErr, "Saving default maps path");
            }
          }
        }
      } catch (error) {
        console.error(
          "[mapsFolderStore] Error getting value from settingsStore:",
          error
        );
        handleError(error, "Loading maps folder setting");
        pathValue = defaultAbsPath;
      } finally {
        // --- FIX: Ensure value passed to setStoreValue is string | null ---
        const finalValue = normalizePath(pathValue) ?? null; // Coalesce undefined/null to null
        setStoreValue(finalValue);
        // --- END FIX ---
        isLoading.set(false);
        console.log(
          `[mapsFolderStore] Lazy load complete. Store value: ${getStoreValue(
            store
          )}`
        );
        initializationPromise = null; // Clear promise on completion
        return finalValue; // Return the final value from the promise
      }
    })(); // Immediately invoke

    return initializationPromise;
  }

  return {
    subscribe,
    isLoading: { subscribe: isLoading.subscribe },
    get: async (): Promise<string | null> => {
      // Always trigger load if needed, return the promise which resolves with the value
      return await loadValueIfNeeded();
    },
    set: async (newPath: string | null) => {
      const normalizedNewPath = normalizePath(newPath);
      if (!normalizedNewPath) {
        handleError(
          "Attempted to set mapsFolder to null or empty.",
          "Saving Maps Path"
        );
        return;
      }
      // Ensure initialization is complete before setting
      // It's better to wait for the value to be loaded first
      if (!hasAttemptedLoad) {
        console.warn(
          "[mapsFolderStore] Waiting for initial load before setting..."
        );
        await loadValueIfNeeded();
      }

      setStoreValue(normalizedNewPath); // Optimistic update
      try {
        await settingsStore.set(SETTINGS_KEY, normalizedNewPath);
        await settingsStore.save();
        console.log("[mapsFolderStore] Saved new path:", normalizedNewPath);
      } catch (error) {
        handleError(error, "Saving maps folder setting");
      }
    },
    // isInitialized flag is less useful now, remove it? Or keep for external checks?
    // isInitialized: () => hasAttemptedLoad,
  };
};

export const mapsFolder = createMapsFolderStore();

// src/lib/stores/mapsFolderStore.ts
import { writable, get, type Writable } from "svelte/store";
import { load } from "@tauri-apps/plugin-store";
import { documentDir, normalize, join } from "@tauri-apps/api/path";
import { normalizePath } from "$lib/ts/pathUtils";
import { handleError } from "$lib/ts/errorHandler";

// Define an interface to type the store API.
interface TauriStore {
  get<T>(key: string): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  save(): Promise<void>;
}

const DEFAULT_MAPS_PATH = "SkaterXL/Maps";
const SETTINGS_KEY = "mapsFolder";
// Use a JSON filename as recommended by the docs.
const STORE_FILENAME = "settings.json";

export interface MapsFolderStoreType {
  subscribe: Writable<string | null>["subscribe"];
  initialize: () => Promise<void>;
  set: (newPath: string | null) => Promise<void>;
  get: () => string | null;
  isInitialized: () => boolean;
}

let settingsStoreInstance: TauriStore | null = null;
let storeInstancePromise: Promise<TauriStore> | null = null;

async function getOrCreateStore(): Promise<TauriStore> {
  if (storeInstancePromise) {
    return storeInstancePromise;
  }
  storeInstancePromise = (async () => {
    console.log("[mapsFolderStore] Creating a new Store instance...");
    // Use load() and cast the result to TauriStore.
    const instance = (await load(STORE_FILENAME, {
      autoSave: false,
    })) as TauriStore;
    console.log("[mapsFolderStore] Store instance created and ready.");
    settingsStoreInstance = instance;
    return instance;
  })();
  return storeInstancePromise;
}

const store = writable<string | null>(null);
const { subscribe, set: setStoreValue } = store;
let isInitialized = false;

async function loadAndInitialize(): Promise<void> {
  if (isInitialized) return;

  let pathValue: string | null = null;
  let defaultAbsPath: string | null = null;

  try {
    const docDir = await documentDir();
    defaultAbsPath = normalizePath(
      await normalize(await join(docDir, DEFAULT_MAPS_PATH))
    );
    if (!defaultAbsPath) {
      defaultAbsPath = "/error/default/path";
    }
  } catch (e) {
    handleError(e, "Calculating default maps path");
    defaultAbsPath = "/error/default/path";
  }

  try {
    const activeStore = await getOrCreateStore();
    // Retrieve the stored value using a typed get call.
    const loadedValue = await activeStore.get<string | null>(SETTINGS_KEY);
    pathValue = loadedValue ?? null;

    // If no value is stored, write the default.
    if (pathValue === null) {
      pathValue = defaultAbsPath;
      if (pathValue && !pathValue.startsWith("/error/")) {
        await activeStore.set<string>(SETTINGS_KEY, pathValue);
        await activeStore.save();
      }
    }
    isInitialized = true;
  } catch (error) {
    console.error("[mapsFolderStore] Error during load/initialize:", error);
    pathValue = defaultAbsPath;
    isInitialized = false;
  } finally {
    setStoreValue(normalizePath(pathValue) ?? null);
    console.log(
      `[mapsFolderStore] Init attempt complete. Initialized: ${isInitialized}, Store value: ${get(
        store
      )}`
    );
  }
}

async function setPathValue(newPath: string | null): Promise<void> {
  const normalizedNewPath = normalizePath(newPath);
  if (!normalizedNewPath) {
    handleError(
      "Attempted to set mapsFolder to null or empty.",
      "Saving Maps Path"
    );
    return;
  }
  setStoreValue(normalizedNewPath);
  try {
    const activeStore = await getOrCreateStore();
    await activeStore.set<string>(SETTINGS_KEY, normalizedNewPath);
    await activeStore.save();
    console.log(
      "[mapsFolderStore] Saved new path to settings:",
      normalizedNewPath
    );
    if (!isInitialized) isInitialized = true;
  } catch (error) {
    console.error("[mapsFolderStore] Error during setPathValue:", error);
  }
}

export const mapsFolder: MapsFolderStoreType = {
  subscribe,
  initialize: loadAndInitialize,
  set: setPathValue,
  get: () => get(store),
  isInitialized: () => isInitialized,
};

// src/lib/stores/mapsFolderStore.ts
import { writable } from "svelte/store";
import { Store } from "@tauri-apps/plugin-store";

const DEFAULT_MAPS_PATH = "SkaterXL/Maps";

// Tell TypeScript to ignore the incorrect "private constructor" error on the next line
// @ts-expect-error Constructor is public in runtime JS despite typing
const settingsStore = new Store(".settings.dat");

const createMapsFolderStore = () => {
  const { subscribe, set: setStoreValue } = writable<string | null>(null);

  async function loadInitialPath() {
    try {
      await settingsStore.load();
      const savedPath = await settingsStore.get<string | null>("mapsFolder");
      if (savedPath) {
        // console.log("Loaded mapsFolder from settings:", savedPath); // Optional log
        setStoreValue(savedPath);
      } else {
        const pathApi = await import("@tauri-apps/api/path");
        const docDir = await pathApi.documentDir();
        const defaultAbsPath = await pathApi.normalize(
          await pathApi.join(docDir, DEFAULT_MAPS_PATH)
        );
        console.log(
          "No saved path found, using default absolute path:",
          defaultAbsPath
        );
        setStoreValue(defaultAbsPath);
        await settingsStore.set("mapsFolder", defaultAbsPath);
        await settingsStore.save();
      }
    } catch (error) {
      console.error("Error loading/initializing maps folder setting:", error);
      try {
        const pathApi = await import("@tauri-apps/api/path");
        const docDir = await pathApi.documentDir();
        const defaultAbsPath = await pathApi.normalize(
          await pathApi.join(docDir, DEFAULT_MAPS_PATH)
        );
        setStoreValue(defaultAbsPath);
      } catch (e2) {
        console.error("Error resolving default maps folder path:", e2);
        setStoreValue(`/error/cannot/resolve/path`);
      }
    }
  }

  loadInitialPath();

  return {
    subscribe,
    set: async (newPath: string | null) => {
      if (newPath === null) {
        console.error("Attempted to set mapsFolder to null.");
        return;
      }
      try {
        setStoreValue(newPath);
        await settingsStore.set("mapsFolder", newPath);
        await settingsStore.save();
        // console.log("Saved new mapsFolder to settings:", newPath); // Optional log
      } catch (error) {
        console.error("Error saving maps folder setting:", error);
      }
    },
  };
};

export const mapsFolder = createMapsFolderStore();

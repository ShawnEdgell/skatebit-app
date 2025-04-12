// src/lib/stores/mapsFolderStore.ts
import { writable } from "svelte/store";

// Default maps folder (relative to BaseDirectory::Document)
export const mapsFolder = writable("SkaterXL/Maps");

// Optional: To persist across sessions, you can initialize from localStorage:
const stored = localStorage.getItem("mapsFolder");
if (stored) {
  mapsFolder.set(stored);
}
mapsFolder.subscribe((value) => {
  localStorage.setItem("mapsFolder", value);
});

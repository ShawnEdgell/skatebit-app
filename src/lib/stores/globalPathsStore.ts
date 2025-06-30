// src/lib/stores/globalPathsStore.ts
import { writable, derived, get } from 'svelte/store'
import { findSkaterXlPath } from '$lib/services/pathService';

let _defaultMapsPath = '';
let _defaultModsPath = '';

export const mapsDirectory = writable<string>('');
export const modsDirectory = writable<string>('');
export const explorerDirectory = writable<string>('');

// Persistent Skater XL game path
export const skaterXLGamePath = writable<string>('');

// Symlink detection
export const isMapsSymlinked = derived(
  mapsDirectory,
  ($mapsDirectory) =>
    _defaultMapsPath !== '' &&
    $mapsDirectory.trim() !== _defaultMapsPath.trim(),
);

export const isModsSymlinked = derived(
  modsDirectory,
  ($modsDirectory) =>
    _defaultModsPath !== '' &&
    $modsDirectory.trim() !== _defaultModsPath.trim(),
);

export async function initializeGlobalPaths() {
  console.log('[GlobalPathsStore] Initializing global paths...');
  const skaterXlPath = await findSkaterXlPath();
  _defaultMapsPath = skaterXlPath ? `${skaterXlPath}/Maps` : '';
  _defaultModsPath = skaterXlPath ? `${skaterXlPath}/Mods` : '';

  const currentGamePath = get(skaterXLGamePath);

  // Maps dir: prefer custom, fallback to default
  const storedMaps = localStorage.getItem('customMapsDirectory') || '';
  mapsDirectory.update((current) => {
    if (!current || current.trim() === '') {
      return storedMaps && storedMaps !== _defaultMapsPath
        ? storedMaps
        : _defaultMapsPath;
    }
    return current;
  });

  // Mods dir: use gamePath if set, else fallback to stored or default
  const storedMods = localStorage.getItem('customModsDirectory') || '';
  modsDirectory.update((current) => {
    if (!current || current.trim() === '') {
      if (storedMods && storedMods !== _defaultModsPath) {
        return storedMods;
      } else if (currentGamePath?.trim()) {
        return `${currentGamePath}/Mods`;
      } else {
        return _defaultModsPath;
      }
    }
    return current;
  });
}

export async function initializeExplorerPaths() {
  const base = (await findSkaterXlPath()) || '';
  console.log('[explorerStore] resolved explorer base path:', base);
  explorerDirectory.set(base);
}

export function setSkaterXLGamePath(path: string) {
  skaterXLGamePath.set(path)
  modsDirectory.set(`${path}/Mods`)
}

// Watchers to persist changes
mapsDirectory.subscribe((val) => {
  if (!_defaultMapsPath) return
  if (val.trim() !== '' && val !== _defaultMapsPath) {
    localStorage.setItem('customMapsDirectory', val)
    console.log('[GlobalPathsStore] Saved custom mapsDirectory:', val)
  } else {
    localStorage.removeItem('customMapsDirectory')
    console.log('[GlobalPathsStore] Reset to default mapsDirectory')
  }
})

modsDirectory.subscribe((val) => {
  if (!_defaultModsPath) return
  if (val.trim() !== '' && val !== _defaultModsPath) {
    localStorage.setItem('customModsDirectory', val)
    console.log('[GlobalPathsStore] Saved custom modsDirectory:', val)
  } else {
    localStorage.removeItem('customModsDirectory')
    console.log('[GlobalPathsStore] Reset to default modsDirectory')
  }
})

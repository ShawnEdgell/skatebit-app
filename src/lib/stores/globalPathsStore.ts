import { writable, derived } from 'svelte/store'
import { resolveDocPath } from '$lib/services/pathService'

// 1. Hold the default (resolved once at startup)
let _defaultMapsPath = ''

// 2. The actual maps‐directory the UI should use:
export const mapsDirectory = writable<string>('')

// 3. A derived boolean: true iff mapsDirectory ≠ default
export const isMapsSymlinked = derived(
  mapsDirectory,
  ($mapsDirectory) =>
    _defaultMapsPath !== '' &&
    $mapsDirectory.trim() !== _defaultMapsPath.trim(),
)

// 4. Explorer’s root
export const explorerDirectory = writable<string>('')

/** Initialize both mapsDirectory & explorerDirectory */
export async function initializeGlobalPaths() {
  // resolve default only once
  _defaultMapsPath = (await resolveDocPath('SkaterXL', 'Maps')) || ''

  // pull any override
  const stored = localStorage.getItem('customMapsDirectory') || ''
  if (stored && stored.trim() !== '' && stored !== _defaultMapsPath) {
    mapsDirectory.set(stored)
  } else {
    mapsDirectory.set(_defaultMapsPath)
  }
}

/** Only for the explorer view */
export async function initializeExplorerPaths() {
  const base = (await resolveDocPath('SkaterXL')) || ''
  explorerDirectory.set(base)
}

mapsDirectory.subscribe((val) => {
  if (!_defaultMapsPath) {
    return
  }
  if (val.trim() !== '' && val !== _defaultMapsPath) {
    localStorage.setItem('customMapsDirectory', val)
    console.log('[GlobalPathsStore] Saved custom mapsDirectory:', val)
  } else {
    localStorage.removeItem('customMapsDirectory')
    console.log('[GlobalPathsStore] Reset to default mapsDirectory')
  }
})

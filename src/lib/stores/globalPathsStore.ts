import { writable, derived } from 'svelte/store'
import { resolveDocPath } from '$lib/services/pathService'

let _defaultMapsPath = ''

export const mapsDirectory = writable<string>('')

export const isMapsSymlinked = derived(
  mapsDirectory,
  ($mapsDirectory) =>
    _defaultMapsPath !== '' &&
    $mapsDirectory.trim() !== _defaultMapsPath.trim(),
)

export const explorerDirectory = writable<string>('')

export async function initializeGlobalPaths() {
  _defaultMapsPath = (await resolveDocPath('SkaterXL', 'Maps')) || ''

  const stored = localStorage.getItem('customMapsDirectory') || ''
  if (stored && stored.trim() !== '' && stored !== _defaultMapsPath) {
    mapsDirectory.set(stored)
  } else {
    mapsDirectory.set(_defaultMapsPath)
  }
}

export async function initializeExplorerPaths() {
  const base = (await resolveDocPath('SkaterXL')) || ''
  explorerDirectory.set(base)
}

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

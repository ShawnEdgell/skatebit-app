import { writable, derived } from 'svelte/store'
import { resolveDocPath } from '$lib/services/pathService'
import { getStoreValue, setStoreValue } from '$lib/utils/tauriStore'

let _defaultMapsPath = ''
let _defaultModsPath = ''

export const mapsDirectory = writable<string>('')
export const modsDirectory = writable<string>('')
export const explorerDirectory = writable<string>('')

// Persistent game path
export const skaterXLGamePath = writable<string>('')

export const isMapsSymlinked = derived(
  mapsDirectory,
  ($mapsDirectory) =>
    _defaultMapsPath !== '' &&
    $mapsDirectory.trim() !== _defaultMapsPath.trim(),
)

export const isModsSymlinked = derived(
  modsDirectory,
  ($modsDirectory) =>
    _defaultModsPath !== '' &&
    $modsDirectory.trim() !== _defaultModsPath.trim(),
)

export async function initializeGlobalPaths() {
  _defaultMapsPath = (await resolveDocPath('SkaterXL', 'Maps')) || ''
  _defaultModsPath = (await resolveDocPath('SkaterXL', 'Mods')) || ''
  const savedGamePath = await getStoreValue<string>('skaterXLGamePath')

  mapsDirectory.update((current) => {
    if (!current || current.trim() === '') {
      const stored = localStorage.getItem('customMapsDirectory') || ''
      return stored && stored !== _defaultMapsPath ? stored : _defaultMapsPath
    }
    return current
  })

  modsDirectory.update((current) => {
    if (!current || current.trim() === '') {
      const stored = localStorage.getItem('customModsDirectory') || ''
      if (stored && stored !== _defaultModsPath) return stored
      if (savedGamePath?.trim()) return `${savedGamePath}/Mods`
      return _defaultModsPath
    }
    return current
  })

  skaterXLGamePath.update((current) => {
    if (!current && savedGamePath?.trim()) return savedGamePath
    return current
  })
}

export async function initializeExplorerPaths() {
  const base = (await resolveDocPath('SkaterXL')) || ''
  explorerDirectory.set(base)
}

export async function loadSkaterXLPath() {
  const stored = await getStoreValue<string>('skaterXLGamePath')
  if (stored) {
    skaterXLGamePath.set(stored)
  } else {
    skaterXLGamePath.set('')
  }
}

mapsDirectory.subscribe((val) => {
  if (!_defaultMapsPath) return
  if (val.trim() !== '' && val !== _defaultMapsPath) {
    localStorage.setItem('customMapsDirectory', val)
  } else {
    localStorage.removeItem('customMapsDirectory')
  }
})

modsDirectory.subscribe((val) => {
  if (!_defaultModsPath) return
  if (val.trim() !== '' && val !== _defaultModsPath) {
    localStorage.setItem('customModsDirectory', val)
  } else {
    localStorage.removeItem('customModsDirectory')
  }
})

export async function saveSkaterXLGamePath(path: string) {
  skaterXLGamePath.set(path)
  await setStoreValue('skaterXLGamePath', path)
}

import { derived, writable } from 'svelte/store'
import { browser } from '$app/environment'
import { currentPath } from './explorerStore'
import { mapsDirectory } from './globalPathsStore'

/** Global “are we dragging anywhere?” flag */
export const isDraggingOver = writable(false)

/**
 * Automatically pick the active drop‐target from explorer ↔ maps.
 * No manual `.set()` needed.
 */
export const activeDropTargetInfo = derived(
  [currentPath, mapsDirectory],
  ([$currentPath, $mapsDirectory]) => {
    if (!browser) {
      return { path: null, label: null }
    }
    if ($currentPath && !$currentPath.startsWith('/error')) {
      return { path: $currentPath, label: 'Current Folder' }
    }
    if ($mapsDirectory) {
      return { path: $mapsDirectory, label: 'Maps Folder' }
    }
    return { path: null, label: null }
  },
)

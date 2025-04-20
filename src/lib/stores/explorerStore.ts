import { writable, get } from 'svelte/store'
import { listen } from '@tauri-apps/api/event'
import { createFolderStore } from './folderStore' // Uses the updated folderStore
import { explorerDirectory, mapsDirectory } from './globalPathsStore' // Import mapsDirectory
import { loadDirectoryEntries } from '$lib/services/fileService'
import { ListingStatus } from '$lib/types/fsTypes'
import type { FsEntry, DirectoryListingResult } from '$lib/types/fsTypes'
import { handleError } from '$lib/utils/errorHandler'
import { localMaps } from './mapsStore' // For the subscription logic
import { browser } from '$app/environment' // Import browser

// Define the folderMissing store used by the loader function
export const folderMissing = writable(false)

// Create the specific store instance for the explorer
const _explorer = createFolderStore<FsEntry, DirectoryListingResult>(
  explorerDirectory, // Base path store
  '', // No subfolder (uses explorerDirectory directly)
  async (dir): Promise<DirectoryListingResult> => {
    // Loader function
    // This loader remains specific to listing general directory entries
    const res = await loadDirectoryEntries(dir)
    // Update folderMissing based on the result of THIS loader call
    folderMissing.set(res.status === ListingStatus.DoesNotExist)
    return res
  },
  (res): FsEntry[] => {
    // Extractor function
    // Extract entries, returning empty if the directory doesn't exist
    return res.status === ListingStatus.DoesNotExist ? [] : res.entries
  },
)

// Export parts of the created store for external use
export const entries = _explorer.entries
export const currentPath = _explorer.currentPath
export const isLoading = _explorer.loading
export const explorerError = _explorer.error
// Export the refresh function; it now implicitly accepts the source argument
// because _explorer.refresh was updated in folderStore.ts
export const refreshExplorer = _explorer.refresh

// Listen for backend events that might affect the current explorer view
if (browser) {
  // Only listen in browser
  ;[
    'explorer-changed',
    'maps-changed',
    'stats-changed',
    'gear-changed',
  ].forEach((evt) => {
    listen(evt, () => {
      // Refresh the *currently viewed* explorer directory or the base explorer path
      const dirToRefresh = get(currentPath) || get(explorerDirectory)
      const source = `Rust Event: ${evt}` // Define source
      if (dirToRefresh && dirToRefresh.trim()) {
        console.log(
          `[explorerStore] Received "${evt}", refreshing explorer for path: ${dirToRefresh} (Source: ${source})`,
        )
        // Call refresh with path and source
        _explorer
          .refresh(dirToRefresh, source) // Pass source argument
          .catch((e) => handleError(e, `Explorer refresh on ${evt}`))
      } else {
        console.warn(
          `[explorerStore] Received "${evt}", but no valid path to refresh.`,
        )
      }
    }).catch((e) => {
      handleError(e, `Attaching ${evt} listener in explorerStore`)
    })
  })
}

// Refresh explorer if the maps list changes AND we are viewing the maps directory
if (browser) {
  // Only subscribe in browser
  localMaps.subscribe(() => {
    const explorerViewPath = get(currentPath)?.trim()
    const currentMapsPath = get(mapsDirectory)?.trim()
    const source = 'localMaps Store Change' // Define source

    if (
      explorerViewPath &&
      currentMapsPath &&
      explorerViewPath === currentMapsPath
    ) {
      console.log(
        `[explorerStore] localMaps changed and current view (${explorerViewPath}) matches maps directory. Refreshing explorer. (Source: ${source})`,
      )
      // Call refresh with path and source
      _explorer
        .refresh(explorerViewPath, source) // Pass source argument
        .catch((e) => handleError(e, 'Explorer refresh on Local Maps change'))
    }
  })
}

// Watcher function (currently a placeholder)
export async function watchExplorer(): Promise<() => void> {
  // If you implement actual watching, ensure it calls refresh with a source
  console.log('[explorerStore] watchExplorer called (currently no-op).')
  return () => {
    console.log(
      '[explorerStore] watchExplorer unlisten called (currently no-op).',
    )
  }
}

// Initializer function (if called explicitly)
export async function initializeStore(): Promise<void> {
  const source = 'initializeStore' // Define source
  console.log(`[explorerStore] Initializing store... (Source: ${source})`)
  // Call refreshExplorer with source
  await refreshExplorer(undefined, source) // Pass source argument
  console.log(`[explorerStore] Initialization refresh complete.`)
}

// Navigation function
export async function setPath(newPath: string): Promise<void> {
  const source = 'setPath Navigation' // Define source
  const pathTrimmed = newPath ? newPath.trim() : ''
  if (!pathTrimmed) {
    console.warn(
      `[explorerStore] setPath called with invalid path: '${newPath}'`,
    )
    return
  }
  console.log(
    `[explorerStore] setPath called for: ${pathTrimmed} (Source: ${source})`,
  )
  // Call refreshExplorer with path and source
  await refreshExplorer(pathTrimmed, source) // Pass source argument
}

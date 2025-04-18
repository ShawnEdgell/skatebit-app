// src/lib/stores/explorerStore.ts
import { writable, get } from 'svelte/store'
import { listen } from '@tauri-apps/api/event'
import { createFolderStore } from './folderStore'
import { explorerDirectory } from './globalPathsStore'
import { loadDirectoryEntries } from '$lib/services/fileService'
import { ListingStatus } from '$lib/types/fsTypes'
import type { FsEntry, DirectoryListingResult } from '$lib/types/fsTypes'
import { handleError } from '$lib/utils/errorHandler'

// NEW: import localMaps & mapsDirectory to coordinate updates
import { localMaps } from './mapsStore'
import { mapsDirectory } from './globalPathsStore'

export const folderMissing = writable(false)

const _explorer = createFolderStore<FsEntry, DirectoryListingResult>(
  explorerDirectory,
  '',
  async (dir) => {
    const res = await loadDirectoryEntries(dir)
    folderMissing.set(res.status === ListingStatus.DoesNotExist)
    return res
  },
  (res) => (res.status === ListingStatus.DoesNotExist ? [] : res.entries),
)

export const entries = _explorer.entries
export const currentPath = _explorer.currentPath
export const isLoading = _explorer.loading
export const explorerError = _explorer.error
export const refreshExplorer = _explorer.refresh

// Auto‑refresh on custom Tauri events (maps‑changed, etc.)
;['explorer-changed', 'maps-changed', 'stats-changed', 'gear-changed'].forEach(
  (evt) => {
    listen(evt, () => {
      const dir = get(currentPath) || get(explorerDirectory)
      if (dir && dir.trim()) {
        _explorer
          .refresh(dir)
          .catch((e) => handleError(e, `Explorer refresh on ${evt}`))
      }
    })
  },
)

// **NEW**: whenever localMaps changes, refresh if viewing the Maps folder
localMaps.subscribe(() => {
  const view = get(currentPath)
  const maps = get(mapsDirectory)
  if (view && maps && view.trim() === maps.trim()) {
    _explorer
      .refresh(view)
      .catch((e) => handleError(e, 'Explorer refresh on Local Maps change'))
  }
})

export async function watchExplorer(): Promise<() => void> {
  // we already set up module‑level listeners above,
  // so watchExplorer can just return a no‑op or cleanup if desired
  return () => {}
}

export async function initializeStore(): Promise<void> {
  await refreshExplorer()
}

export async function setPath(newPath: string): Promise<void> {
  await refreshExplorer(newPath)
}

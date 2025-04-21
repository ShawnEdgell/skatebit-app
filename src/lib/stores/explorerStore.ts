import { writable, get } from 'svelte/store'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { browser } from '$app/environment'
import { explorerDirectory } from './globalPathsStore'
import { loadDirectoryEntries } from '$lib/services/fileService'
import { ListingStatus } from '$lib/types/fsTypes'
import type { FsEntry, DirectoryListingResult } from '$lib/types/fsTypes'
import { handleError } from '$lib/utils/errorHandler'

export const folderMissing = writable(false)
export const entries = writable<FsEntry[]>([])
export const currentPath = writable<string>('')
export const isLoading = writable(false)
export const explorerError = writable<Error | undefined>(undefined)

let unlistenWatcher: (() => void) | undefined

async function refresh(dir?: string) {
  const path = dir ?? get(currentPath) ?? ''
  if (!path) return

  isLoading.set(true)
  try {
    const res = await loadDirectoryEntries(path)
    folderMissing.set(res.status === ListingStatus.DoesNotExist)
    entries.set(res.status === ListingStatus.DoesNotExist ? [] : res.entries)
    explorerError.set(undefined)
  } catch (e) {
    explorerError.set(e as Error)
  } finally {
    isLoading.set(false)
  }
}

export const refreshExplorer = refresh

async function startWatcher(path: string) {
  try {
    await invoke('add_watched_path', { path })
  } catch (e) {
    handleError(e, 'add_watched_path')
  }
  if (browser) {
    try {
      unlistenWatcher = await listen<{ path: string; kind: string }>(
        'rust-fs-change',
        (event) => {
          if (event.payload.path.startsWith(path)) {
            void refresh(path)
          }
        },
      )
    } catch (e) {
      handleError(e, 'listen rust-fs-change')
    }
  }
}

async function stopWatcher(path: string) {
  if (browser && unlistenWatcher) {
    unlistenWatcher()
    unlistenWatcher = undefined
  }
  try {
    await invoke('remove_watched_path', { path })
  } catch {
    /* ignore */
  }
}

export async function setPath(dir: string) {
  const prev = get(currentPath)
  if (prev) {
    await stopWatcher(prev)
  }
  if (!dir) return

  currentPath.set(dir)
  await refresh(dir)
  await startWatcher(dir)
}

// Whenever explorerDirectory changes, switch paths + watcher
explorerDirectory.subscribe((dir) => {
  void setPath(dir)
})

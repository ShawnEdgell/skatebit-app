import { writable, get, type Readable, type Writable } from 'svelte/store'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { browser } from '$app/environment'
import type { DirectoryListingResult } from '$lib/types/fsTypes'
import { handleError } from '$lib/utils/errorHandler'

export interface DirectoryStore<E> {
  entries: Writable<E[]>
  loading: Writable<boolean>
  error: Writable<string | null>
  currentPath: Writable<string>
  refresh: (path?: string) => Promise<void>
  setPath: (path: string) => Promise<void>
}

export function createDirectoryStore<E, R extends DirectoryListingResult>(
  basePathStore: Readable<string>,
  opts: {
    loadFn: (fullPath: string) => Promise<R>
    extract: (res: R) => E[]
    useMapsWatcher?: boolean
  },
): DirectoryStore<E> {
  const entries = writable<E[]>([])
  const loading = writable(false)
  const error = writable<string | null>(null)
  const currentPath = writable<string>('')

  let unlisten: (() => void) | null = null
  let manualUpdateInProgress = false

  function markManualUpdate() {
    manualUpdateInProgress = true
  }

  async function _watch(oldPath: string | null, newPath: string) {
    try {
      if (opts.useMapsWatcher && oldPath) {
        await invoke('update_maps_watched_path', {
          old_path: oldPath,
          new_path: newPath,
        })
      } else {
        if (oldPath) {
          await invoke('remove_watched_path', { path: oldPath })
        }
        await invoke('add_watched_path', { path: newPath })
      }
    } catch (e) {
      console.warn('[directoryStore] watcher command failed', e)
    }

    if (browser) {
      unlisten?.()
      unlisten = await listen<{ path: string; kind: string }>(
        'rust-fs-change',
        (evt) => {
          if (manualUpdateInProgress) {
            manualUpdateInProgress = false
            return
          }
          const currentPathValue = get(currentPath)
          if (
            currentPathValue &&
            evt.payload.path.startsWith(currentPathValue)
          ) {
            void refresh()
          }
        },
      )
    }
  }

  async function setPath(dir: string) {
    const prev = get(currentPath)
    if (prev && prev !== dir) {
      await _watch(prev, dir)
    } else if (!prev && dir) {
      await _watch(null, dir)
    }
    if (dir) {
      currentPath.set(dir)
      markManualUpdate()
      await refresh(dir)
    } else {
      currentPath.set('')
      entries.set([])
      error.set('Invalid directory path provided to setPath.')
      loading.set(false)
    }
  }

  async function refresh(explicit?: string) {
    const dir =
      (explicit?.trim() ||
        get(currentPath)?.trim() ||
        get(basePathStore)?.trim()) ??
      ''
    if (!dir) {
      entries.set([])
      error.set('No directory path specified for refresh.')
      return
    }

    if (explicit) markManualUpdate()
    if (dir === get(currentPath) && get(loading)) return

    loading.set(true)
    error.set(null)
    try {
      const res = await opts.loadFn(dir)

      if (res && typeof res === 'object' && 'status' in res) {
        const resultWithStatus = res as DirectoryListingResult
        if (resultWithStatus.status === 'doesNotExist') {
          const pathInError = resultWithStatus.path || dir
          error.set(`This folder does not exist yet: ${pathInError}`)
          entries.set([])
        } else {
          entries.set(opts.extract(res))
          if (!('status' in res) || res.status !== 'doesNotExist') {
            error.set(null)
          }
        }
      } else {
        console.warn(
          "[directoryStore] Result from loadFn missing 'status' property.",
        )
        entries.set(opts.extract(res))
        error.set(null)
      }
      currentPath.set(dir)
    } catch (e: any) {
      console.error('[directoryStore] load error', e)
      handleError(e, `[directoryStore] load error for ${dir}`)
      error.set(e.message ?? String(e))
      entries.set([])
    } finally {
      loading.set(false)
    }
  }

  basePathStore.subscribe((bp) => {
    if (bp?.trim() && browser) {
      void setPath(bp.trim())
    }
  })

  return { entries, loading, error, currentPath, refresh, setPath }
}

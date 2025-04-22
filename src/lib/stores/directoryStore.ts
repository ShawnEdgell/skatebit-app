import { writable, get, type Readable, type Writable } from 'svelte/store'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { browser } from '$app/environment'
import type {
  DirectoryListingResult,
  FsEntry,
  ListingStatus,
} from '$lib/types/fsTypes' // <-- Import missing types
import { handleError } from '$lib/utils/errorHandler' // <-- Import handleError if used in catch

export interface DirectoryStore<E> {
  entries: Writable<E[]>
  loading: Writable<boolean>
  error: Writable<string | null>
  currentPath: Writable<string>
  /** Reloads the given path (or the currentPath if omitted) */
  refresh: (path?: string) => Promise<void>
  /** Switches to a new path, starts watching it, then loads it */
  setPath: (path: string) => Promise<void>
}

export function createDirectoryStore<E, R extends DirectoryListingResult>( // Constrain R slightly if always used with status
  basePathStore: Readable<string>,
  opts: {
    loadFn: (fullPath: string) => Promise<R>
    extract: (
      res: R,
    ) => E[] /** If true, uses `update_maps_watched_path` instead of remove/add */
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
      // Optionally use handleError here if preferred over console.warn
      // handleError(e, '[directoryStore] Watcher command failed');
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
          // Check if currentPath has a value before calling startsWith
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
      // Ensure dir is not empty
      await _watch(null, dir)
    }
    if (dir) {
      // Only set path and refresh if dir is valid
      currentPath.set(dir)
      markManualUpdate()
      await refresh(dir)
    } else {
      // Handle empty/invalid dir case if needed (e.g., clear state)
      currentPath.set('')
      entries.set([])
      error.set('Invalid directory path provided to setPath.')
      loading.set(false)
    }
  }

  async function refresh(explicit?: string) {
    const dir =
      (explicit?.trim() ||
        get(currentPath)?.trim() || // Add null check
        get(basePathStore)?.trim()) ?? // Add null check
      ''
    if (!dir) {
      entries.set([])
      error.set('No directory path specified for refresh.') // Set error
      return
    }

    if (explicit) markManualUpdate()
    if (dir === get(currentPath) && get(loading)) return

    loading.set(true)
    error.set(null)
    try {
      const res = await opts.loadFn(dir) // R is expected to be DirectoryListingResult based on usage

      // Use explicit checks and type guard for status
      if (res && typeof res === 'object' && 'status' in res) {
        const resultWithStatus = res as DirectoryListingResult // Type assertion after check
        if (resultWithStatus.status === 'doesNotExist') {
          // Use string comparison or import ListingStatus enum
          const pathInError = resultWithStatus.path || dir
          error.set(`This folder does not exist yet: ${pathInError}`)
          entries.set([])
        } else {
          // Status is not DoesNotExist, or status field doesn't exist
          entries.set(opts.extract(res))
          // Ensure error is null only if load was successful AND status wasn't DoesNotExist
          if (!('status' in res) || res.status !== 'doesNotExist') {
            error.set(null)
          }
        }
      } else {
        // Fallback if result doesn't have a status property (shouldn't happen with current Rust code)
        console.warn(
          "[directoryStore] Result from loadFn missing 'status' property.",
        )
        entries.set(opts.extract(res)) // Assume success if status missing? Or set error?
        error.set(null) // Assuming success if status is missing
      }
      // Only update currentPath if we didn't hit the 'doesNotExist' case? Or always update?
      // Keeping original logic: always update path if refresh was called for it.
      currentPath.set(dir)
    } catch (e: any) {
      console.error('[directoryStore] load error', e)
      handleError(e, `[directoryStore] load error for ${dir}`) // Use handleError
      error.set(e.message ?? String(e))
      entries.set([])
    } finally {
      loading.set(false)
    }
  }

  // Use effect cleanup for listeners? Maybe not needed if component handles it
  // onDestroy(() => { unlisten?.(); }); // Consider if needed here or just in layout

  basePathStore.subscribe((bp) => {
    if (bp?.trim() && browser) {
      // Ensure runs only in browser
      void setPath(bp.trim())
    }
  })

  return { entries, loading, error, currentPath, refresh, setPath }
}

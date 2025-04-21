import { writable, get, type Readable, type Writable } from 'svelte/store'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { browser } from '$app/environment'

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

export function createDirectoryStore<E, R>(
  basePathStore: Readable<string>,
  opts: {
    loadFn: (fullPath: string) => Promise<R>
    extract: (res: R) => E[]
    /** If true, uses `update_maps_watched_path` instead of remove/add */
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

  /** Internal helper to invoke the Tauri watcher commands */
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
          // skip exactly one watcher event right after our manual update
          if (manualUpdateInProgress) {
            manualUpdateInProgress = false
            return
          }
          if (evt.payload.path.startsWith(get(currentPath))) {
            void refresh()
          }
        },
      )
    }
  }

  /** Switch to a new directory, start watching it, then load it */
  async function setPath(dir: string) {
    const prev = get(currentPath)
    if (prev && prev !== dir) {
      await _watch(prev, dir)
    } else if (!prev) {
      await _watch(null, dir)
    }
    currentPath.set(dir)
    // this is a “manual” load, so mark before refresh
    markManualUpdate()
    await refresh(dir)
  }

  /** Load (or reload) a directory listing */
  async function refresh(explicit?: string) {
    const dir =
      (explicit?.trim() ||
        get(currentPath).trim() ||
        get(basePathStore).trim()) ??
      ''
    if (!dir) {
      entries.set([])
      return
    }

    // if this is our manual trigger, mark it
    if (explicit) markManualUpdate()

    // avoid re‑loading same path while already loading
    if (dir === get(currentPath) && get(loading)) return

    loading.set(true)
    error.set(null)
    try {
      const res = await opts.loadFn(dir)
      entries.set(opts.extract(res))
      currentPath.set(dir)
    } catch (e: any) {
      console.error('[directoryStore] load error', e)
      error.set(e.message ?? String(e))
      entries.set([])
    } finally {
      loading.set(false)
    }
  }

  // whenever the base path store changes, switch & load
  basePathStore.subscribe((bp) => {
    if (bp?.trim()) {
      void setPath(bp.trim())
    }
  })

  return { entries, loading, error, currentPath, refresh, setPath }
}

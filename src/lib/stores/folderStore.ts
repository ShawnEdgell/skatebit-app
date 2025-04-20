// src/lib/stores/folderStore.ts
import { writable, get, type Readable, type Writable } from 'svelte/store'
import { listen } from '@tauri-apps/api/event'
import { handleError } from '$lib/utils/errorHandler'

export interface FolderStore<E> {
  entries: Writable<E[]>
  loading: Writable<boolean>
  error: Writable<string | null>
  currentPath: Writable<string>
  refresh: (path?: string) => Promise<void>
  watch: () => Promise<() => void>
}

/**
 * @param basePathStore  Store holding your root path (e.g. Documents/SkaterXL)
 * @param subfolder      Name of the child folder ('' for explorer, 'Maps', etc.)
 * @param loaderFn       Function that, given a full path, returns a Promise<R>
 * @param extractor      Function that pulls your E[] out of R
 */
export function createFolderStore<E, R>(
  basePathStore: Readable<string>,
  subfolder: string,
  loaderFn: (fullPath: string) => Promise<R>,
  extractor: (r: R) => E[],
): FolderStore<E> {
  const entries = writable<E[]>([])
  const loading = writable(false)
  const error = writable<string | null>(null)
  const currentPath = writable<string>('')

  function computePath(): string {
    const base = get(basePathStore).trim()
    return subfolder ? `${base}/${subfolder}` : base
  }

  async function refresh(path?: string) {
    loading.set(true)
    error.set(null)
    try {
      const dir =
        (path && path.trim()) ||
        (get(currentPath) && get(currentPath).trim()) ||
        computePath()

      if (!dir) {
        entries.set([])
        currentPath.set('')
      } else {
        const result = await loaderFn(dir)
        const list = extractor(result)
        entries.set(list)
        currentPath.set(dir)
      }
    } catch (e: any) {
      handleError(e, `Refreshing ${subfolder || 'Explorer'}`)
      error.set(e.message ?? String(e))
      entries.set([])
    } finally {
      loading.set(false)
    }
  }

  async function watch() {
    const channel = subfolder
      ? `${subfolder.toLowerCase()}-changed`
      : 'explorer-changed'
    const unlisten = await listen(channel, () => refresh())
    return () => unlisten()
  }

  basePathStore.subscribe(() => {
    refresh()
  })

  return { entries, loading, error, currentPath, refresh, watch }
}

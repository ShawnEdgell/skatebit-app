// src/lib/stores/folderStore.ts
import { writable, get, type Readable, type Writable } from 'svelte/store'
import { handleError } from '$lib/utils/errorHandler'
import { browser } from '$app/environment'

export interface FolderStore<E> {
  entries: Writable<E[]>
  loading: Writable<boolean>
  error: Writable<string | null>
  currentPath: Writable<string>
  refresh: (
    path?: string,
    source?: string,
    immediate?: boolean,
  ) => Promise<void>
}

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

  let lastPath = ''
  let lastTime = 0

  function computeFullPath(base: string | null): string {
    const b = base?.trim() ?? ''
    return b ? (subfolder ? `${b}/${subfolder}` : b) : ''
  }

  async function refresh(
    rawPath?: string,
    source = 'manual',
    immediate = false,
  ): Promise<void> {
    const explicit = rawPath?.trim() ?? ''
    const stored = get(currentPath)?.trim() ?? ''
    const fallback = computeFullPath(get(basePathStore))
    const dir = (explicit || stored || fallback).trim()

    if (!dir) {
      if (browser) console.warn(`[FolderStore ${subfolder}] No valid path`)
      entries.set([])
      currentPath.set('')
      return
    }

    const now = Date.now()
    if (dir === lastPath && now - lastTime < 300) {
      if (browser)
        console.log(`[FolderStore ${subfolder}] Skipping duplicate refresh`)
      return
    }

    if (get(loading)) return
    loading.set(true)
    error.set(null)

    try {
      const result = await loaderFn(dir)
      const list = extractor(result)
      entries.set(list)
      currentPath.set(dir)
    } catch (e: any) {
      handleError(e, `FolderStore ${subfolder} load error`)
      error.set(e.message ?? String(e))
      entries.set([])
    } finally {
      loading.set(false)
      lastPath = dir
      lastTime = now
    }
  }

  return { entries, loading, error, currentPath, refresh }
}

// src/lib/stores/folderStore.ts
import { writable, get, type Readable, type Writable } from 'svelte/store'
import { handleError } from '$lib/utils/errorHandler'
import { browser } from '$app/environment'

export interface FolderStore<E> {
  entries: Writable<E[]>
  loading: Writable<boolean>
  error: Writable<string | null>
  currentPath: Writable<string>
  /**
   * Refresh listing.
   * @param path optional explicit path override
   * @param source for logs
   * @param immediate bypass debounce (true = run instantly)
   */
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

  // Build default path = basePathStore + subfolder
  function computeFullPath(base: string | null): string {
    const b = base?.trim() ?? ''
    return b ? (subfolder ? `${b}/${subfolder}` : b) : ''
  }

  // Actually perform the load
  async function _load(dir: string, src: string) {
    if (get(loading)) {
      if (browser)
        console.log(
          `[FolderStore ${subfolder || 'ROOT'}] skip "${src}" — already loading`,
        )
      return
    }
    loading.set(true)
    error.set(null)
    let success = false

    try {
      if (browser)
        console.log(
          `[FolderStore ${subfolder || 'ROOT'}] load "${src}" → '${dir}'`,
        )

      const result = await loaderFn(dir)
      const list = extractor(result)
      entries.set(list)
      currentPath.set(dir)
      success = true

      if (browser)
        console.log(
          `[FolderStore ${subfolder || 'ROOT'}] loaded ${list.length} entries for '${dir}'`,
        )
    } catch (e: any) {
      handleError(e, `FolderStore ${subfolder || 'ROOT'} load error (${src})`)
      error.set(e.message ?? String(e))
      entries.set([])
    } finally {
      loading.set(false)
      if (!success && browser)
        console.log(
          `[FolderStore ${subfolder || 'ROOT'}] finished "${src}" without data`,
        )
    }
  }

  // Tiny leading-edge only debounce: allow one call, then block for `wait`
  function leadingDebounce<F extends (...args: any[]) => void>(
    fn: F,
    wait: number,
  ): F {
    let ready = true
    return ((...args: any[]) => {
      if (!ready) return
      ready = false
      fn(...args)
      setTimeout(() => {
        ready = true
      }, wait)
    }) as F
  }

  const debouncedLoad = leadingDebounce(_load, 150)

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
      if (browser)
        console.warn(
          `[FolderStore ${subfolder || 'ROOT'}] "${source}" with no valid path`,
        )
      entries.set([])
      currentPath.set('')
      return
    }

    if (immediate) {
      await _load(dir, source)
    } else {
      debouncedLoad(dir, source)
    }
  }

  return { entries, loading, error, currentPath, refresh }
}

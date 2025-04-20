import { writable, get, type Readable, type Writable } from 'svelte/store'
// Removed 'listen' as watch() is commented out/removed
// import { listen } from '@tauri-apps/api/event';
import { handleError } from '$lib/utils/errorHandler'
import { browser } from '$app/environment' // Import browser for safety

export interface FolderStore<E> {
  entries: Writable<E[]>
  loading: Writable<boolean>
  error: Writable<string | null>
  currentPath: Writable<string> // Path currently loaded
  refresh: (path?: string) => Promise<void>
  // watch is removed for now as it's not used and potentially problematic
  // watch: () => Promise<() => void>;
}

/**
 * Creates a Svelte store tailored for managing the contents of a specific folder.
 * @param basePathStore Store holding the root path (e.g., mapsDirectory or explorerDirectory).
 * @param subfolder Subfolder relative to the basePathStore ('', 'Maps', 'Gear', etc.).
 * @param loaderFn Async function that takes a full path and returns the raw data (type R).
 * @param extractor Function that takes the raw data (R) and returns the array of entries (E[]).
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
  // Initialize currentPath only in browser to avoid SSR issues with get() potentially
  const currentPath = writable<string>('')

  // Helper to compute the full path (handles subfolder logic)
  // Now safer for SSR contexts as it doesn't rely on get() outside of functions
  function computeFullPath(base: string | null): string {
    const basePath = base ? base.trim() : ''
    if (!basePath) return ''
    // Simple join, assumes normalizePath used elsewhere if needed before calling loaderFn
    return subfolder ? `${basePath}/${subfolder}` : basePath
  }

  async function refresh(path?: string): Promise<void> {
    // Debouncing is handled by the calling store (mapsStore/explorerStore)
    loading.set(true)
    error.set(null)
    let didLoad = false

    try {
      // Determine path: Explicit path > current store value > computed default from base store
      const explicitPath = path ? path.trim() : ''
      // Use get() carefully, ensure it's called when store is definitely subscribed (e.g., within component or browser)
      const currentStoredPath = browser ? (get(currentPath)?.trim() ?? '') : ''
      const defaultComputedPath = browser
        ? computeFullPath(get(basePathStore))
        : '' // Compute based on current base

      let dir = ''
      if (explicitPath) {
        dir = explicitPath
      } else if (currentStoredPath) {
        dir = currentStoredPath
      } else {
        dir = defaultComputedPath
      }

      dir = dir.trim()

      if (!dir) {
        if (browser)
          console.warn(
            `[FolderStore ${subfolder || 'ROOT'}] Refresh called with no valid path.`,
          )
        entries.set([])
        currentPath.set('')
      } else {
        if (browser)
          console.log(
            `[FolderStore ${subfolder || 'ROOT'}] Refresh: Loading path '${dir}'`,
          )
        const result = await loaderFn(dir)
        const list = extractor(result)
        entries.set(list)
        currentPath.set(dir) // Update currentPath AFTER successful load
        didLoad = true
        if (browser)
          console.log(
            `[FolderStore ${subfolder || 'ROOT'}] Refresh: Successfully loaded ${list.length} entries for '${dir}'`,
          )
      }
    } catch (e: any) {
      handleError(e, `Refreshing ${subfolder || 'base path'}`)
      error.set(e.message ?? String(e))
      entries.set([])
      // Optionally clear currentPath on error?
      // currentPath.set('');
    } finally {
      loading.set(false)
      if (!didLoad && browser) {
        console.log(
          `[FolderStore ${subfolder || 'ROOT'}] Refresh: Finished without loading (invalid path or error).`,
        )
      }
    }
  }

  // Watch function removed as event handling is managed externally now
  // async function watch() { ... }

  // Removed internal subscription to basePathStore

  // *** FIX: Added missing return statement ***
  return {
    entries,
    loading,
    error,
    currentPath,
    refresh,
    // watch is removed
  }
}

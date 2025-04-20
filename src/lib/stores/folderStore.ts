// src/lib/stores/folderStore.ts
import { writable, get, type Readable, type Writable } from 'svelte/store'
import { handleError } from '$lib/utils/errorHandler'
import { browser } from '$app/environment'

export interface FolderStore<E> {
  entries: Writable<E[]>
  loading: Writable<boolean>
  error: Writable<string | null>
  currentPath: Writable<string>
  // *** Update refresh signature ***
  refresh: (path?: string, source?: string) => Promise<void>
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

  function computeFullPath(base: string | null): string {
    const basePath = base ? base.trim() : ''
    if (!basePath) return ''
    return subfolder ? `${basePath}/${subfolder}` : basePath
  }

  // *** Update refresh signature and add source logging ***
  async function refresh(
    path?: string,
    source: string = 'Unknown',
  ): Promise<void> {
    loading.set(true)
    error.set(null)
    let didLoad = false
    const triggerSource = source // Capture source

    try {
      const explicitPath = path ? path.trim() : ''
      const currentStoredPath = browser ? (get(currentPath)?.trim() ?? '') : ''
      const defaultComputedPath = browser
        ? computeFullPath(get(basePathStore))
        : ''

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
            `[FolderStore ${subfolder || 'ROOT'}] Refresh triggered by "${triggerSource}" - called with no valid path.`,
          )
        entries.set([])
        currentPath.set('')
      } else {
        if (browser)
          console.log(
            `[FolderStore ${subfolder || 'ROOT'}] Refresh triggered by "${triggerSource}" - Loading path '${dir}'`,
          )
        const result = await loaderFn(dir)
        const list = extractor(result)
        entries.set(list)
        currentPath.set(dir)
        didLoad = true
        if (browser)
          console.log(
            `[FolderStore ${subfolder || 'ROOT'}] Refresh triggered by "${triggerSource}" - Successfully loaded ${list.length} entries for '${dir}'`,
          )
      }
    } catch (e: any) {
      // Log error with source context
      handleError(
        e,
        `Refreshing ${subfolder || 'base path'} (Triggered by: ${triggerSource})`,
      )
      error.set(e.message ?? String(e))
      entries.set([])
    } finally {
      loading.set(false)
      if (!didLoad && browser) {
        console.log(
          `[FolderStore ${subfolder || 'ROOT'}] Refresh triggered by "${triggerSource}" - Finished without loading.`,
        )
      }
    }
  }

  // Removed internal subscription and watch function

  return {
    entries,
    loading,
    error,
    currentPath,
    refresh,
  }
}

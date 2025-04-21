// import { writable, get, type Writable } from 'svelte/store'
// import { invoke } from '@tauri-apps/api/core'
// import { dirname } from '@tauri-apps/api/path'
// import type {
//   FsEntry,
//   DirectoryListingResult,
//   ListingStatus,
// } from '$lib/types/fsTypes'
// import { ListingStatus as ListingStatusEnum } from '$lib/types/fsTypes'
// import { normalizePath } from './pathService'
// import { handleError } from '$lib/utils/errorHandler'
// import { browser } from '$app/environment'

// export interface DirectoryState {
//   status: ListingStatus
//   entries: FsEntry[]
//   loading: boolean
//   error: string | null
//   lastUpdated: number
// }

// const directoryCache = new Map<string, Writable<DirectoryState>>()
// const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes cache validity

// function createInitialDirectoryState(path: string): DirectoryState {
//   return {
//     status: ListingStatusEnum.DoesNotExist,
//     entries: [] as FsEntry[],
//     loading: false,
//     error: null,
//     lastUpdated: 0,
//   }
// }

// async function fetchAndUpdateStore(
//   path: string,
//   store: Writable<DirectoryState>,
// ): Promise<void> {
//   store.update((s) => ({ ...s, loading: true, error: null }))
//   try {
//     const result = await invoke<DirectoryListingResult>(
//       'list_directory_entries',
//       {
//         absolutePath: normalizePath(path),
//       },
//     )
//     store.set({
//       status: result.status,
//       entries: result.entries,
//       loading: false,
//       error: null,
//       lastUpdated: Date.now(),
//     })
//   } catch (err) {
//     // err is 'unknown'
//     // Pass the original error to handleError for logging/toast
//     handleError(err, `Loading directory: ${path}`)

//     // *** FIX: Check type before accessing .message ***
//     let errorMsg: string
//     if (err instanceof Error) {
//       errorMsg = err.message // Safe to access .message
//     } else if (typeof err === 'string') {
//       errorMsg = err // Handle if a string was thrown
//     } else {
//       errorMsg = 'An unknown error occurred while loading directory.' // Fallback
//     }

//     store.update((s) => ({
//       ...s,
//       status: ListingStatusEnum.DoesNotExist, // Assume error means inaccessible
//       entries: [],
//       loading: false,
//       error: errorMsg, // Set the extracted/fallback error message
//       lastUpdated: Date.now(),
//     }))
//   }
// }

// export function getStoreForPath(path: string): Writable<DirectoryState> {
//   const normalized = normalizePath(path)
//   if (!normalized) {
//     return writable(createInitialDirectoryState(''))
//   }

//   let store = directoryCache.get(normalized)

//   if (!store) {
//     store = writable(createInitialDirectoryState(normalized))
//     directoryCache.set(normalized, store)
//     if (browser) {
//       void fetchAndUpdateStore(normalized, store)
//     }
//   } else {
//     const state = get(store)
//     // Refresh in background if stale and not already loading
//     if (!state.loading && Date.now() - state.lastUpdated > CACHE_DURATION_MS) {
//       if (browser) {
//         void fetchAndUpdateStore(normalized, store)
//       }
//     }
//   }
//   return store
// }

// export async function refreshPath(path: string): Promise<void> {
//   const normalized = normalizePath(path)
//   if (!normalized || !browser) return

//   const store = directoryCache.get(normalized)
//   if (store) {
//     await fetchAndUpdateStore(normalized, store)
//   } else {
//     // Ensure store exists and fetch is triggered if not cached
//     getStoreForPath(normalized)
//   }
// }

// export async function notifyChange(changedPath: string): Promise<void> {
//   if (!browser || !changedPath) return
//   const normalizedChangedPath = normalizePath(changedPath)

//   // Refresh the specific path if it's cached
//   if (directoryCache.has(normalizedChangedPath)) {
//     await refreshPath(normalizedChangedPath)
//   }
//   // Also refresh the parent directory if it's cached
//   try {
//     const parentPath = await dirname(normalizedChangedPath)
//     const normalizedParent = normalizePath(parentPath)
//     // Avoid refreshing root or same path, check cache
//     if (
//       normalizedParent &&
//       normalizedParent !== normalizedChangedPath &&
//       directoryCache.has(normalizedParent)
//     ) {
//       await refreshPath(normalizedParent)
//     }
//   } catch (e) {
//     // Silently ignore errors getting dirname (e.g., for root paths)
//   }
// }

// export function clearDirectoryCache(): void {
//   if (browser) {
//     directoryCache.clear()
//   }
// }

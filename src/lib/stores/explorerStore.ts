import { explorerDirectory } from './globalPathsStore'
import { loadDirectoryEntries } from '$lib/services/fileService'
import type { DirectoryListingResult, FsEntry } from '$lib/types/fsTypes'
import { createDirectoryStore } from './directoryStore'

export const explorerStore = createDirectoryStore<
  FsEntry,
  DirectoryListingResult
>(explorerDirectory, {
  loadFn: (p) => loadDirectoryEntries(p),
  extract: (res) => res.entries,
  // explorer never needs maps‐specific watcher
})

export const {
  entries,
  loading: isLoading,
  error: explorerError,
  currentPath,
  refresh,
  setPath,
} = explorerStore

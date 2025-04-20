import { invoke } from '@tauri-apps/api/core'
import type { DirectoryListingResult } from '$lib/types/fsTypes'
import { normalizePath } from './pathService'

export const loadLocalMaps = async (absolutePath: string) =>
  invoke<DirectoryListingResult>('list_local_maps', {
    relativeMapsPath: normalizePath(absolutePath),
  })

export const loadDirectoryEntries = async (absolutePath: string) =>
  invoke<DirectoryListingResult>('list_directory_entries', {
    absolutePath: normalizePath(absolutePath),
  })

export const createDirectory = async (absolutePath: string): Promise<void> =>
  invoke('create_directory_rust', {
    absolutePath: normalizePath(absolutePath),
  })

export const createFile = async (absolutePath: string): Promise<void> =>
  invoke('create_empty_file_rust', {
    absolutePath: normalizePath(absolutePath),
  })

export const renameEntry = async (
  oldAbsolutePath: string,
  newAbsolutePath: string,
): Promise<void> =>
  invoke('rename_fs_entry_rust', {
    oldAbsolutePath: normalizePath(oldAbsolutePath),
    newAbsolutePath: normalizePath(newAbsolutePath),
  })

export const deleteEntry = async (absolutePath: string): Promise<void> =>
  invoke('delete_fs_entry_rust', {
    absolutePath: normalizePath(absolutePath),
  })

export const downloadAndInstall = async (
  url: string,
  destinationSubfolder: string,
): Promise<void> =>
  invoke('download_and_install', {
    url,
    destinationSubfolder: normalizePath(destinationSubfolder),
  })

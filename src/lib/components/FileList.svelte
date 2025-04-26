<script lang="ts">
  import { invoke } from '@tauri-apps/api/core'
  import { join } from '@tauri-apps/api/path'
  import type { FsEntry } from '$lib/types/fsTypes'
  import { formatFileSize } from '$lib/utils/formatter'
  import { normalizePath } from '$lib/services/pathService'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import { openModal, toastStore } from '$lib/stores/uiStore'
  import { explorerDirectory } from '$lib/stores/globalPathsStore'
  import {
    currentPath,
    entries,
    explorerError,
    setPath,
    refresh,
  } from '$lib/stores/explorerStore'
  import { get } from 'svelte/store'

  import { Folder, FileText, Edit2, Trash2 } from 'lucide-svelte'

  export let loading = false

  async function handleOpenDirectory(folderName: string) {
    if (!$currentPath) return handleError('Current path is not set', 'Open')
    const newPath = await join($currentPath, folderName)
    await setPath(normalizePath(newPath))
  }

  async function handleCreateDirectory() {
    const path = get(currentPath)
    if (!path) return handleError('Invalid target path', 'Create Dir')
    const normPath = normalizePath(path)
    try {
      await invoke('create_directory_rust', { absolutePath: normPath })
      handleSuccess(`Folder created at ${normPath}`, 'File Operation')
      await refresh(normPath)
    } catch (err) {
      handleError(err, `Failed to create folder at ${normPath}`)
    }
  }

  async function onRename(name: string, itemPath: string) {
    if (!$currentPath || $currentPath.startsWith('/error')) {
      return handleError(
        'Cannot rename: Current path is invalid.',
        'Rename Setup',
      )
    }
    openModal({
      title: `Rename "${name}"`,
      placeholder: 'Enter new name',
      initialValue: name,
      confirmText: 'Rename',
      cancelText: 'Cancel',
      confirmClass: 'btn-primary',
      onSave: async (newInputValue?: string) => {
        const newName = newInputValue?.trim()
        if (!newName || newName === name) return
        const exists = $entries.find(
          (e) => !!e.name && e.name.toLowerCase() === newName.toLowerCase(),
        )
        if (exists) {
          const t = exists.isDirectory ? 'folder' : 'file'
          toastStore.addToast(
            `A ${t} named "${newName}" already exists.`,
            'alert-error',
          )
          return
        }
        const normOld = normalizePath(itemPath)
        if (!normOld) {
          return handleError(
            'Could not normalize original item path.',
            'Rename',
          )
        }
        const parent = normOld.slice(0, normOld.lastIndexOf('/')) || '/'
        let newAbsolute = ''
        try {
          newAbsolute = normalizePath(await join(parent, newName))
        } catch (e) {
          return handleError(e, 'Computing new path for rename')
        }
        if (!newAbsolute || newAbsolute === normOld) {
          toastStore.addToast(
            'Computed new path is invalid or identical to the original.',
            'alert-error',
          )
          return
        }
        try {
          await invoke('rename_fs_entry_rust', {
            oldPath: normOld,
            newPath: newAbsolute,
          })
          await refresh()
          handleSuccess(`Renamed "${name}" to "${newName}"`, 'File Operation')
        } catch (error) {
          handleError(error, `Renaming ${name} to ${newName}`)
        }
      },
    })
  }

  async function onDelete(name: string, itemPath: string) {
    const normItem = normalizePath(itemPath)
    const normBase = normalizePath($explorerDirectory)
    if (!normItem || (normBase && normItem === normBase)) {
      return handleError(
        'Invalid deletion target or attempting to delete base directory.',
        'Deletion',
      )
    }
    openModal({
      title: 'Confirm Deletion',
      message: `Move "${name}" to Recycle Bin?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmClass: 'btn-error',
      onSave: async () => {
        try {
          await invoke('delete_fs_entry_rust', { absolutePath: normItem })
          await refresh()
          handleSuccess(`Deleted "${name}"`, 'File Operation')
        } catch (error) {
          handleError(error, `Deleting ${name}`)
        }
      },
    })
  }
</script>

<div class="relative h-full">
  {#if $explorerError}
    <div
      class="flex h-full flex-col items-center justify-center gap-4 p-4 text-center"
    >
      <h3 class="text-warning text-xl font-semibold">Folder Not Found</h3>
      <p class="text-base-content/60 w-md">{$explorerError}</p>
      <button class="btn btn-primary btn-sm" on:click={handleCreateDirectory}>
        Create Folder Now
      </button>
    </div>
  {:else}
    {#if loading && $entries.length === 0}
      <div
        class="bg-base-100/75 absolute inset-0 z-10 flex items-center justify-center"
      >
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {/if}

    {#if !loading && $entries.length === 0}
      <div class="flex h-full items-center justify-center p-4">
        <p class="text-info mb-4 text-sm">This folder is empty.</p>
      </div>
    {:else}
      <ul>
        {#each $entries as entry (entry.path)}
          <li>
            <div
              class="hover:bg-base-300 flex w-full items-center justify-between gap-2 rounded-lg"
            >
              <button
                class="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-2 py-1 text-left"
                on:click={() =>
                  entry.isDirectory ? handleOpenDirectory(entry.name!) : null}
                title={entry.name}
              >
                {#if entry.isDirectory}
                  <Folder class="text-info h-5 w-5" />
                {:else}
                  <FileText class="text-base-content/80 h-5 w-5" />
                {/if}
                <span class="flex-1 truncate">{entry.name}</span>
                {#if entry.size != null}
                  <span class="badge badge-xs badge-ghost ml-auto">
                    {formatFileSize(entry.size)}
                  </span>
                {/if}
              </button>

              <div class="flex gap-1">
                <button
                  title="Rename"
                  class="btn btn-xs btn-ghost text-warning hover:bg-warning hover:text-warning-content"
                  on:click|stopPropagation={() =>
                    onRename(entry.name!, entry.path)}
                  disabled={!entry.name}
                >
                  <Edit2 class="h-4 w-4" />
                </button>
                <button
                  title="Delete"
                  class="btn btn-xs btn-ghost text-error hover:bg-error hover:text-error-content"
                  on:click|stopPropagation={() =>
                    onDelete(entry.name!, entry.path)}
                  disabled={!entry.name}
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

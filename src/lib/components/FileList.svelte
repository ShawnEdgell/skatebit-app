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
    setPath,
    refreshExplorer,
    folderMissing,
  } from '$lib/stores/explorerStore'

  export let loading: boolean = false

  $: missingPath = $folderMissing ? $currentPath : null

  async function handleOpenDirectory(folderName: string) {
    try {
      if (!$currentPath) throw new Error('Current path is not set')
      const newPath = await join($currentPath, folderName)
      await setPath(normalizePath(newPath))
    } catch (error) {
      handleError(error, 'Opening directory')
    }
  }

  async function handleCreateDirectory() {
    const targetPath = $currentPath
    if (!targetPath || targetPath.startsWith('/error')) {
      handleError(
        'Cannot create directory: Target path is invalid.',
        'Create Directory',
      )
      return
    }
    const pathToCreate = normalizePath(targetPath)
    const folderName = pathToCreate.split('/').pop() || pathToCreate

    try {
      await invoke('create_directory_rust', { absolutePath: pathToCreate })
      await refreshExplorer()
      handleSuccess(`Folder "${folderName}" created.`, 'File Operation')
    } catch (error) {
      handleError(error, `Creating directory "${folderName}"`)
    }
  }

  async function onRename(name: string, itemPath: string) {
    if (!$currentPath || $currentPath.startsWith('/error')) {
      handleError('Cannot rename: Current path is invalid.', 'Rename Setup')
      return
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
          (e) => e?.name?.toLowerCase() === newName.toLowerCase(),
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
          handleError('Could not normalize original item path.', 'Rename')
          return
        }

        const parent = normOld.slice(0, normOld.lastIndexOf('/')) || '/'
        let newAbsolute = ''
        try {
          newAbsolute = normalizePath(await join(parent, newName))
        } catch (e) {
          handleError(e, 'Computing new path for rename')
          return
        }
        if (!newAbsolute || newAbsolute === normOld) {
          toastStore.addToast(
            'Computed new path is invalid or identical to the original.',
            'alert-error',
          )
          return
        }

        try {
          // 🚨 correct argument names:
          await invoke('rename_fs_entry_rust', {
            oldPath: normOld,
            newPath: newAbsolute,
          })
          // 🔥 immediate refresh for snappiness:
          await refreshExplorer()
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
      handleError(
        'Invalid deletion target or attempting to delete base directory.',
        'Deletion',
      )
      return
    }

    openModal({
      title: 'Confirm Deletion',
      message: `Move "${name}" to Recycle Bin?`,
      confirmOnly: false,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmClass: 'btn-error',
      onSave: async () => {
        try {
          await invoke('delete_fs_entry_rust', { absolutePath: normItem })
          await refreshExplorer()
          handleSuccess(`Deleted "${name}"`, 'File Operation')
        } catch (error) {
          handleError(error, `Deleting ${name}`)
        }
      },
    })
  }

  function safeName(entry: FsEntry | undefined | null): string {
    return entry?.name ?? ''
  }
  function isActionable(entry: FsEntry | undefined | null): boolean {
    return !!entry && entry.name !== null
  }
</script>

<div class="h-full">
  {#if loading}
    <div class="absolute inset-0 z-10 flex items-center justify-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  {#if missingPath}
    <div
      class="flex h-full flex-col items-center justify-center gap-4 p-4 text-center"
    >
      <h3 class="text-warning text-xl font-semibold">Folder Not Found</h3>
      <p class="text-base-content/60 w-md">
        This folder doesn’t exist yet. You can create it now.
      </p>
      <button
        class="btn btn-primary btn-sm mt-2"
        on:click={handleCreateDirectory}
      >
        Create Folder Now
      </button>
    </div>
  {:else if !loading && $entries.length}
    <ul>
      {#each $entries as entry (entry.path)}
        <li>
          <div
            class="hover:bg-base-300 flex w-full items-center justify-between gap-2 rounded-lg"
          >
            {#if entry.isDirectory}
              <button
                class="group flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-2 py-1 text-left disabled:cursor-not-allowed disabled:opacity-50"
                on:click={() => handleOpenDirectory(safeName(entry))}
                title={safeName(entry)}
                disabled={!isActionable(entry)}
              >
                <span class="text-info text-xl">📁</span>
                <span class="flex-1 truncate">{safeName(entry)}</span>
                {#if entry.size != null}
                  <span
                    class="badge badge-xs badge-ghost mr-2 ml-auto flex-shrink-0"
                  >
                    {formatFileSize(entry.size)}
                  </span>
                {/if}
              </button>
            {:else}
              <div
                class="group flex min-w-0 flex-1 cursor-default items-center gap-3 px-2 py-1 text-left"
              >
                <span class="text-base-content/80 text-xl">📄</span>
                <span class="flex-1 truncate">{safeName(entry)}</span>
                {#if entry.size != null}
                  <span
                    class="badge badge-xs badge-ghost mr-2 ml-auto flex-shrink-0"
                  >
                    {formatFileSize(entry.size)}
                  </span>
                {/if}
              </div>
            {/if}

            <div class="flex flex-shrink-0 gap-1">
              {#if isActionable(entry)}
                <button
                  title="Rename"
                  class="btn btn-xs btn-ghost text-warning hover:bg-warning hover:text-warning-content"
                  on:click|stopPropagation={() =>
                    onRename(safeName(entry), entry.path)}
                >
                  ✏️
                </button>
                <button
                  title="Delete"
                  class="btn btn-xs btn-ghost text-error hover:bg-error hover:text-error-content"
                  on:click|stopPropagation={() =>
                    onDelete(safeName(entry), entry.path)}
                >
                  🗑️
                </button>
              {:else}
                <button class="btn btn-xs btn-ghost" disabled>✏️</button>
                <button class="btn btn-xs btn-ghost" disabled>🗑️</button>
              {/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else if !loading}
    <div class="flex h-full items-center justify-center p-4">
      <p class="text-info mb-4">This folder is empty.</p>
    </div>
  {/if}
</div>

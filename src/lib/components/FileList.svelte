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
    const pathTocreate = normalizePath(targetPath)
    const folderName = pathTocreate.split('/').pop() || pathTocreate
    try {
      await invoke('create_directory_rust', { absolutePath: pathTocreate })
      handleSuccess(`Folder "${folderName}" created.`, 'File Operation')
      folderMissing.set(false)
      await refreshExplorer()
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
        if (!newName) {
          toastStore.addToast('New name cannot be empty.', 'alert-warning')
          return
        }
        if (newName === name) {
          return
        }

        const existingEntry = $entries.find(
          (entry) => entry?.name?.toLowerCase() === newName.toLowerCase(),
        )
        if (existingEntry) {
          const existingType = existingEntry.isDirectory ? 'folder' : 'file'
          toastStore.addToast(
            `A ${existingType} named "${newName}" already exists.`,
            'alert-error',
          )
          return
        }

        const normItemPath = normalizePath(itemPath)
        if (!normItemPath) {
          handleError('Could not normalize original item path.', 'Rename')
          return
        }

        const parentDir =
          normItemPath.substring(0, normItemPath.lastIndexOf('/')) || '/'
        let newAbsolutePath = ''
        try {
          newAbsolutePath = normalizePath(await join(parentDir, newName))
        } catch (joinError) {
          handleError(joinError, 'Computing new path for rename')
          return
        }

        if (!newAbsolutePath || newAbsolutePath === normItemPath) {
          toastStore.addToast(
            'Computed new path is invalid or identical to the original.',
            'alert-error',
          )
          return
        }

        try {
          await invoke('rename_fs_entry_rust', {
            oldAbsolutePath: normItemPath,
            newAbsolutePath: newAbsolutePath,
          })
          handleSuccess(`Renamed "${name}" to "${newName}"`, 'File Operation')
          await refreshExplorer()
        } catch (error) {
          handleError(error, `Renaming ${name} to ${newName}`)
        }
      },
    })
  }

  async function onDelete(name: string, itemPath: string) {
    const normItemPath = normalizePath(itemPath)
    const normBasePath = normalizePath($explorerDirectory)

    if (!normItemPath || (normBasePath && normItemPath === normBasePath)) {
      handleError(
        'Invalid deletion target or attempting to delete base directory.',
        'Deletion',
      )
      return
    }

    openModal({
      title: 'Confirm Deletion',
      message: `Move "${name}"? to Recycle Bin?`,
      confirmOnly: false,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmClass: 'btn-error',
      onSave: async () => {
        try {
          await invoke('delete_fs_entry_rust', { absolutePath: normItemPath })
          handleSuccess(`Deleted "${name}"`, 'File Operation')
          await refreshExplorer()
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
    <div
      class="bg-base-200/50 absolute inset-0 z-10 flex items-center justify-center"
    >
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {/if}

  {#if missingPath}
    <div
      class="flex h-full flex-col items-center justify-center gap-4 p-4 text-center"
    >
      <h3 class="text-warning text-xl font-semibold">Folder Not Found</h3>
      <p class="text-base-content/60 w-md">
        The folder doesn't seem to exist yet. Some mods require specific
        folders. You can create it now if needed.
      </p>
      <button
        class="btn btn-primary btn-sm mt-2"
        on:click={handleCreateDirectory}
      >
        Create Folder Now
      </button>
    </div>
  {:else if !loading && $entries && $entries.length > 0}
    <ul>
      {#each $entries as entry (entry?.path ?? Math.random())}
        {#if entry}
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
                  <span class="text-info group-hover:text-info-content text-xl"
                    >📁</span
                  >
                  <span class="flex-1 truncate"
                    >{safeName(entry) || 'Unnamed Folder'}</span
                  >
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
                  class="group flex min-w-0 flex-1 cursor-default items-center gap-3 px-2 py-1 text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    class="text-base-content/80 group-hover:text-base-content text-xl"
                    >📄</span
                  >
                  <span class="flex-1 truncate"
                    >{safeName(entry) || 'Unnamed File'}</span
                  >
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
                      onRename(safeName(entry), entry.path)}>✏️</button
                  >
                  <button
                    title="Delete"
                    class="btn btn-xs btn-ghost text-error hover:bg-error hover:text-error-content"
                    on:click|stopPropagation={() =>
                      onDelete(safeName(entry), entry.path)}>🗑️</button
                  >
                {:else}
                  <button
                    class="btn btn-xs btn-ghost"
                    disabled
                    title="Cannot rename unnamed item">✏️</button
                  >
                  <button
                    class="btn btn-xs btn-ghost"
                    disabled
                    title="Cannot delete unnamed item">🗑️</button
                  >
                {/if}
              </div>
            </div>
          </li>
        {/if}
      {/each}
    </ul>
  {:else if !loading}
    <div class="flex h-full items-center justify-center p-4">
      <p class="text-info mb-4">The folder is empty.</p>
    </div>
  {/if}
</div>

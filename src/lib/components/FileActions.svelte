<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { invoke } from '@tauri-apps/api/core'
  import { join } from '@tauri-apps/api/path'
  import { revealItemInDir } from '@tauri-apps/plugin-opener'
  import type { FsEntry } from '$lib/types/fsTypes'
  import {
    currentPath,
    entries,
    refreshExplorer,
  } from '$lib/stores/explorerStore'
  import { openModal, toastStore } from '$lib/stores/uiStore'
  import { normalizePath } from '$lib/services/pathService'
  import { handleError, handleSuccess } from '$lib/utils/errorHandler'

  const dispatch = createEventDispatcher()

  function onUploadClick() {
    dispatch('upload')
  }

  async function createNewItem(itemType: 'folder' | 'file') {
    const isFolder = itemType === 'folder'
    const typeCapitalized = isFolder ? 'Folder' : 'File'
    const typeLower = isFolder ? 'folder' : 'file'

    if (!$currentPath || $currentPath.startsWith('/error')) {
      handleError(
        `Cannot create ${typeLower}: Current path is invalid.`,
        `New ${typeCapitalized}`,
      )
      return
    }

    openModal({
      title: `Create New ${typeCapitalized}`,
      placeholder: `Enter ${typeLower} name`,
      initialValue: '',
      confirmOnly: false,
      confirmText: 'Create',
      cancelText: 'Cancel',
      confirmClass: 'btn-primary',
      onSave: async (name?: string) => {
        const trimmed = name?.trim()
        if (!trimmed) {
          toastStore.addToast(
            `${typeCapitalized} name cannot be empty.`,
            'alert-warning',
          )
          return
        }

        const exists = $entries.find(
          (e: FsEntry) => e?.name?.toLowerCase() === trimmed.toLowerCase(),
        )
        if (exists) {
          const existingType = exists.isDirectory ? 'folder' : 'file'
          toastStore.addToast(
            `A ${existingType} named "${trimmed}" already exists.`,
            'alert-error',
          )
          return
        }

        let newPath = ''
        try {
          newPath = await join($currentPath, trimmed)
          await invoke(
            isFolder ? 'create_directory_rust' : 'create_empty_file_rust',
            { absolutePath: normalizePath(newPath) },
          )

          // ⚡️ immediate UI update:
          await refreshExplorer()

          handleSuccess(
            `${typeCapitalized} "${trimmed}" created.`,
            'File Operation',
          )
        } catch (error) {
          handleError(error, `Creating ${typeLower} "${trimmed}"`)
        }
      },
    })
  }

  const onNewFolder = () => createNewItem('folder')
  const onNewFile = () => createNewItem('file')

  async function openCurrentPathInExplorer() {
    if (!$currentPath || $currentPath.startsWith('/error')) {
      handleError('Current path is not available or invalid.', 'Open Explorer')
      return
    }
    try {
      await revealItemInDir($currentPath)
    } catch (error) {
      handleError(error, `Failed to reveal path: ${$currentPath}`)
    }
  }
</script>

<div class="flex w-full flex-wrap items-center gap-2">
  <button
    class="btn btn-ghost btn-xs btn-square text-base-content/80 tooltip tooltip-bottom z-50"
    data-tip="Open Folder"
    aria-label="Open current folder in File Explorer"
    on:click={openCurrentPathInExplorer}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="h-4 w-4"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V10.5m-4.5 0V6.75A2.25 2.25 0 0 0 14.25 4.5H9.75A2.25 2.25 0 0 0 7.5 6.75v1.5"
      />
    </svg>
  </button>

  <button
    class="btn btn-ghost btn-xs btn-square text-success tooltip tooltip-bottom z-50"
    data-tip="New Folder"
    aria-label="Create New Folder"
    on:click={onNewFolder}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="h-4 w-4"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
      />
    </svg>
  </button>

  <button
    class="btn btn-ghost btn-xs btn-square text-info tooltip tooltip-bottom z-50"
    data-tip="New File"
    aria-label="Create New File"
    on:click={onNewFile}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="h-4 w-4"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  </button>

  <button
    class="btn btn-ghost btn-xs btn-square text-base-content tooltip tooltip-bottom z-50"
    data-tip="Upload"
    aria-label="Upload Files"
    on:click={onUploadClick}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="h-4 w-4"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  </button>
</div>

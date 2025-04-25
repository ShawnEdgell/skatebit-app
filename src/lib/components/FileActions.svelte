<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { invoke } from '@tauri-apps/api/core'
  import { join } from '@tauri-apps/api/path'
  import { revealItemInDir } from '@tauri-apps/plugin-opener'
  import { FolderOpen, FolderPlus, FilePlus, Upload } from 'lucide-svelte'
  import type { FsEntry } from '$lib/types/fsTypes'
  import { currentPath, entries, refresh } from '$lib/stores/explorerStore'
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

          await refresh()

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
    <FolderOpen class="h-4 w-4" aria-hidden="true" />
  </button>

  <button
    class="btn btn-ghost btn-xs btn-square text-success tooltip tooltip-bottom z-50"
    data-tip="New Folder"
    aria-label="Create New Folder"
    on:click={onNewFolder}
  >
    <FolderPlus class="h-4 w-4" aria-hidden="true" />
  </button>

  <button
    class="btn btn-ghost btn-xs btn-square text-info tooltip tooltip-bottom z-50"
    data-tip="New File"
    aria-label="Create New File"
    on:click={onNewFile}
  >
    <FilePlus class="h-4 w-4" aria-hidden="true" />
  </button>

  <button
    class="btn btn-ghost btn-xs btn-square text-base-content tooltip tooltip-bottom z-50"
    data-tip="Upload"
    aria-label="Upload Files"
    on:click={onUploadClick}
  >
    <Upload class="h-4 w-4" aria-hidden="true" />
  </button>
</div>

<!-- src/lib/features/explorer/ExplorerLayout.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { join } from '@tauri-apps/api/path';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { uploadFilesToCurrentPath } from '$lib/utils/useFileUpload';
  import { handleDroppedPaths } from '$lib/services/dragDropService';
  import { explorerDirectory } from '$lib/stores/globalPathsStore';
  import { currentPath, entries, isLoading, refreshExplorer, setPath, folderMissing } from '$lib/stores/explorerStore';
  import TabSwitcher from '$lib/features/explorer/components/TabSwitcher.svelte';
  import FileList from '$lib/features/explorer/components/FileList.svelte';
  import PathHeader from '$lib/features/explorer/components/PathHeader.svelte';
  import FileActions from '$lib/features/explorer/components/FileActions.svelte';
  import DropOverlay from '$lib/components/DropOverlay.svelte';
  import { explorerTabs as tabs } from './tabs';
  import { normalizePath } from '$lib/services/pathService';
  import { openModal } from '$lib/stores/uiStore';
  import { toastStore } from '$lib/stores/uiStore';
  import { handleError, handleSuccess } from '$lib/utils/errorHandler';
  import { invoke } from '@tauri-apps/api/core';

  let fileInput: HTMLInputElement;
  let isDraggingOverZone = false;
  let unlisten: (() => void) | null = null;

  $: missingPath = $folderMissing ? $currentPath : null;

  async function handleOpenDirectory(folderName: string) {
    try {
      const newPath = await join($currentPath, folderName);
      const newAbsolutePath = normalizePath(newPath);
      await setPath(newAbsolutePath);
    } catch (error) {
      handleError(error, "Opening directory");
    }
  }

  async function handleGoBack() {
    const curr = $currentPath;
    // Basic check if already at root or invalid
    if (!curr || curr.split(/[\/\\]/).filter(Boolean).length <= 1) return;
    try {
       // More robust parent path calculation needed for Windows/Unix roots
       const pathParts = curr.split(/[\/\\]/).filter(Boolean);
       const parentPath = pathParts.slice(0, -1).join('/') || '/'; // Handle root case
       await setPath(normalizePath(parentPath));
    } catch (error) {
       handleError(error, "Going back");
    }
  }

  async function handleCreateDirectory() {
    const targetPath = $currentPath || $explorerDirectory;
    if (!targetPath || targetPath.startsWith('/error')) {
      handleError("Cannot create directory: Target path is invalid.", "Create Directory");
      return;
    }
    try {
      const newDirFullPath = await join(targetPath, "New Folder"); // Example: Determine new path if needed
      await invoke('create_directory_rust', { absolutePath: newDirFullPath });
      handleSuccess(`Folder created successfully`, 'File Operation'); // Simplified message
      await refreshExplorer(); // Refresh to show the new folder
    } catch (error) {
      handleError(error, `Creating directory`); // Simplified message
    }
  }

  onMount(async () => {
    // Setup drag/drop listener
    try {
      unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
        const payload = event.payload;
        if (payload.type === 'over') {
          isDraggingOverZone = true;
        } else if (payload.type === 'drop') {
          isDraggingOverZone = false; // Reset on drop regardless of success
          if (payload.paths && payload.paths.length > 0) {
            try {
              if (!$currentPath || $currentPath.startsWith('/error')) {
                throw new Error("Current path is invalid for drop operation.");
              }
              await handleDroppedPaths(payload.paths, $currentPath);
              await refreshExplorer();
            } catch (error) {
              handleError(error, 'Handling dropped files');
            }
          }
        } else if (payload.type === 'leave') {
          isDraggingOverZone = false;
        }
      });
    } catch(error) {
        handleError(error, "Initializing drag and drop listener");
    }
  });

  onDestroy(() => {
    // Cleanup listener
    unlisten?.();
  });

  async function handleSwitchTab(subfolder: string) {
    if (!$explorerDirectory || $explorerDirectory.startsWith('/error')) {
      handleError("Base path not initialized", "Switch Tab");
      return;
    }
    try {
      const newAbsolutePath = normalizePath(await join($explorerDirectory, subfolder));
      await setPath(newAbsolutePath);
    } catch (error) {
      handleError(error, "Switching tab");
    }
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target?.files;
    if (!$currentPath || $currentPath.startsWith('/error')) {
      handleError("Cannot upload: Current path is invalid.", "Upload");
      return;
    }
    await uploadFilesToCurrentPath(files, $currentPath, async () => {
      await refreshExplorer();
      if (target) target.value = ''; // Reset file input
    });
  }

  function onUpload() {
    fileInput?.click();
  }

  async function onRename(name: string, itemPath: string) {
    if (!$currentPath || $currentPath.startsWith('/error')) {
      handleError("Cannot rename: Current path is invalid.", "Rename Setup");
      return;
    }
    openModal({
      title: `Rename "${name}"`,
      placeholder: "Enter new name",
      initialValue: name,
      confirmText: 'Rename',
      cancelText: 'Cancel',
      confirmClass: 'btn-primary',
      onSave: async (newInputValue?: string) => {
        const newName = newInputValue?.trim();
        if (!newName) {
          toastStore.addToast('New name cannot be empty.', 'alert-warning');
          return;
        }
        if (newName === name) {
          // Optional: Do nothing or show info toast
          // toastStore.addToast('Name unchanged.', 'alert-info');
          return;
        }
        // Check for existing entry (case-insensitive compare might be better)
        const existingEntry = $entries.find(entry => entry?.name?.toLowerCase() === newName.toLowerCase());
        if (existingEntry) {
          const existingType = existingEntry.isDirectory ? 'folder' : 'file';
          toastStore.addToast(`A ${existingType} named "${newName}" already exists.`, 'alert-error');
          return;
        }
        const normItemPath = normalizePath(itemPath);
        if (!normItemPath) {
             handleError("Could not normalize original item path.", "Rename");
             return;
        }
        // Derive parent directory
        const parentDir = normItemPath.substring(0, normItemPath.lastIndexOf('/')) || '/';

        let newAbsolutePath = '';
        try {
          newAbsolutePath = normalizePath(await join(parentDir, newName));
        } catch (joinError) {
          handleError(joinError, "Computing new path for rename");
          return;
        }

        if (!newAbsolutePath || newAbsolutePath === normItemPath) {
          toastStore.addToast('Computed new path is invalid or identical to the original.', 'alert-error');
          return;
        }

        try {
          await invoke('rename_fs_entry_rust', {
            oldAbsolutePath: normItemPath,
            newAbsolutePath: newAbsolutePath
          });
          handleSuccess(`Renamed "${name}" to "${newName}"`, 'File Operation');
          await refreshExplorer();
        } catch (error) {
          handleError(error, `Renaming ${name} to ${newName}`);
        }
      }
    });
  }

  async function onDelete(name: string, itemPath: string) {
    const normItemPath = normalizePath(itemPath);
    const normBasePath = normalizePath($explorerDirectory);

    if (!normItemPath || (normBasePath && normItemPath === normBasePath) ) {
         handleError("Invalid deletion target or attempting to delete base directory.", "Deletion");
         return;
    }

    openModal({
      title: "Confirm Deletion",
      message: `Permanently delete "${name}"? This cannot be undone.`,
      confirmOnly: false,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmClass: 'btn-error',
      onSave: async () => {
        try {
          await invoke('delete_fs_entry_rust', { absolutePath: normItemPath });
          // Use handleSuccess for consistency, or keep toastStore if preferred
          handleSuccess(`Deleted "${name}"`, 'File Operation');
          // toastStore.addToast(`Deleted "${name}"`, 'alert-warning');
          await refreshExplorer();
        } catch (error) {
          handleError(error, `Deleting ${name}`);
        }
      }
    });
  }

  async function onNewFolder() {
     if (!$currentPath || $currentPath.startsWith('/error')) {
         handleError("Cannot create folder: Current path is invalid.", "New Folder");
         return;
     }
    openModal({
      title: 'Create New Folder',
      placeholder: 'Enter folder name',
      initialValue: '',
      confirmOnly: false,
      confirmText: 'Create',
      cancelText: 'Cancel',
      confirmClass: 'btn-primary',
      onSave: async (folderName?: string) => {
        const trimmedName = folderName?.trim();
        if (!trimmedName) {
          toastStore.addToast('Folder name cannot be empty.', 'alert-warning');
          return;
        }
        // Case-insensitive check for existing
        const existingEntry = $entries.find(entry => entry?.name?.toLowerCase() === trimmedName.toLowerCase());
        if (existingEntry) {
          const existingType = existingEntry.isDirectory ? 'folder' : 'file';
          toastStore.addToast(`A ${existingType} named "${trimmedName}" already exists.`, 'alert-error');
          return;
        }
        let newPath = '';
        try {
          newPath = await join($currentPath, trimmedName);
          await invoke('create_directory_rust', { absolutePath: normalizePath(newPath) });
          handleSuccess(`Folder "${trimmedName}" created.`, 'File Operation');
          await refreshExplorer();
        } catch (error) {
          handleError(error, `Creating folder ${trimmedName}`);
        }
      }
    });
  }

  async function onNewFile() {
     if (!$currentPath || $currentPath.startsWith('/error')) {
         handleError("Cannot create file: Current path is invalid.", "New File");
         return;
     }
    openModal({
      title: 'Create New File',
      placeholder: 'Enter file name',
      initialValue: '',
      confirmOnly: false,
      confirmText: 'Create',
      cancelText: 'Cancel',
      confirmClass: 'btn-primary',
      onSave: async (fileName?: string) => {
        const trimmedName = fileName?.trim();
        if (!trimmedName) {
          toastStore.addToast('File name cannot be empty.', 'alert-warning');
          return;
        }
        const existingEntry = $entries.find(entry => entry?.name?.toLowerCase() === trimmedName.toLowerCase());
        if (existingEntry) {
          const existingType = existingEntry.isDirectory ? 'folder' : 'file';
          toastStore.addToast(`A ${existingType} named "${trimmedName}" already exists.`, 'alert-error');
          return;
        }
        let newPath = '';
        try {
          newPath = await join($currentPath, trimmedName);
          await invoke('create_empty_file_rust', { absolutePath: normalizePath(newPath) });
          handleSuccess(`File "${trimmedName}" created.`, 'File Operation');
          await refreshExplorer();
        } catch (error) {
          handleError(error, `Creating file ${trimmedName}`);
        }
      }
    });
  }

  async function openCurrentPathInExplorer() {
    if (!$currentPath || $currentPath.startsWith('/error')) {
      handleError('Current path is not available or invalid.', 'Open Explorer');
      return;
    }
    try {
      // revealItemInDir usually expects a file or specific dir to highlight,
      // opening just the directory itself might require a different approach
      // or just passing the path might work on some OSes. Test this carefully.
      await revealItemInDir($currentPath);
    } catch (error) {
      handleError(error, `Failed to reveal path: ${$currentPath}`);
    }
  }

  // Removed unused reactive block for isBaseSkaterXlFolderMissing

</script>

<DropOverlay show={isDraggingOverZone} />

<div class="flex h-full w-full bg-base-300">
  <div class="flex flex-col flex-1 w-full overflow-hidden px-4 pb-4 gap-4">
    <div class="flex justify-between items-center w-full flex-shrink-0 bg-base-100 p-2 rounded-box shadow-md">
      <div class="flex-grow overflow-hidden min-w-0 mr-4">
        <PathHeader
          currentPath={$currentPath}
          onGoBack={handleGoBack}
          absoluteBasePath={$explorerDirectory}
        />
      </div>
      <div class="flex-shrink-0">
        <FileActions
          onNewFolder={onNewFolder}
          onNewFile={onNewFile}
          onUpload={onUpload}
          onOpenExplorer={openCurrentPathInExplorer}
        />
      </div>
    </div>
    <div class="flex h-full mb-16.5 w-full overflow-hidden gap-4">
      <TabSwitcher
        tabs={tabs}
        currentPath={$currentPath}
        baseFolder={$explorerDirectory}
        onSwitchTab={handleSwitchTab}
      />
      <div class="h-full w-full overflow-y-auto rounded-box bg-base-100 p-2 shadow relative min-h-0">
        {#if $isLoading && $entries.length === 0}
          <div class="absolute inset-0 flex items-center justify-center text-center p-4 z-10 bg-base-100/50 rounded-box">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else}
          {#key $currentPath}
            <FileList
              entries={$entries}
              loading={$isLoading && $entries.length > 0}
              missingPath={missingPath}
              onOpenDirectory={handleOpenDirectory}
              onRename={onRename}
              onDelete={onDelete}
              onCreate={handleCreateDirectory}
            />
          {/key}
        {/if}
      </div>
    </div>
  </div>
  <input type="file" multiple bind:this={fileInput} on:change={handleFileChange} class="hidden" />
</div>
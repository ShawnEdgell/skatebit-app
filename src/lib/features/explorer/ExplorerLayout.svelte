<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get, writable } from 'svelte/store';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { documentDir, normalize, join } from '@tauri-apps/api/path';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { uploadFilesToCurrentPath } from '$lib/utils/useFileUpload';
  import { baseFolder as relativeBaseFolderConst, handleDroppedPaths } from '$lib';
  import { explorerStore } from '$lib/stores/explorerStore';
  import { TabSwitcher, FileList, PathHeader, FileActions } from './components';
  import DropOverlay from '$lib/components/DropOverlay.svelte';
  import { explorerTabs as tabs } from './tabs';
  import { normalizePath } from '$lib/ts/pathUtils';
  import { openModal } from "$lib/stores/modalStore";
  import { renameEntry, createFolder, createFile, deleteEntry } from '$lib/ts/fsOperations';
  import { toastStore } from '$lib/stores/toastStore';
  import { refreshLocalMaps } from '$lib/stores/localMapsStore';
  import { handleError } from '$lib/ts/errorHandler';

  const { currentPath, entries, isLoading, refresh, setPath, goUp } = explorerStore;

  let fileInput: HTMLInputElement;
  let isDraggingOverZone = false;
  let unlisten: (() => void) | null = null;
  let absoluteBaseFolderPath = writable<string>('');
  let documentDirPath = writable<string>('');

  onMount(async () => {
      try {
          const docDir = await normalize(await documentDir());
          documentDirPath.set(docDir);
          const absBase = await normalize(await join(docDir, relativeBaseFolderConst));
          absoluteBaseFolderPath.set(absBase);
          if (!get(currentPath) || get(currentPath) === "/error/failed/to/init") {
              explorerStore.setPath(absBase);
          }
      } catch (error) {
           handleError(error, "Explorer Layout Initialization");
           absoluteBaseFolderPath.set("/error/init/base");
      }
    unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
        const payload = event.payload;
        switch (payload.type) {
            case 'over': isDraggingOverZone = true; break;
            case 'drop':
                if ('paths' in payload && payload.paths?.length > 0) {
                    try {
                        const relativeDest = await getRelativePathForCommand(get(currentPath));
                        if (relativeDest !== null) {
                           await handleDroppedPaths(payload.paths, relativeDest);
                           await refresh();
                        }
                    } catch (error) {
                        console.error('Drop Handle Error:', error);
                        toastStore.addToast(`Error handling dropped files: ${error}`, "alert-error");
                    }
                }
                isDraggingOverZone = false; break;
            case 'leave': isDraggingOverZone = false; break;
      }
    });
  });

  onDestroy(() => { unlisten?.(); });

  async function getRelativePathForCommand(absolutePath: string): Promise<string | null> {
       const docDir = get(documentDirPath);
       if (!docDir || !absolutePath) return null;
       try {
           const normalizedAbsPath = normalizePath(absolutePath);
           const normalizedDocDir = normalizePath(docDir);
           if (normalizedAbsPath.startsWith(normalizedDocDir)) {
               let relPath = normalizedAbsPath.substring(normalizedDocDir.length).replace(/^[\/\\]/, '');
               relPath = relPath === '' ? '.' : relPath;
               if (relPath.startsWith('..')) { throw new Error("Cannot perform action outside document root."); }
               return normalizePath(relPath);
           } else { throw new Error("Action path is outside document directory."); }
       } catch (error) { handleError(error, `Calculating relative path for ${absolutePath}`); return null; }
  }

  async function handleSwitchTab(subfolder: string) {
    const base = get(absoluteBaseFolderPath);
    if (!base) { return; }
    try {
        const newAbsolutePath = await normalize(await join(base, subfolder));
        setPath(newAbsolutePath);
    } catch (error) { handleError(error, "Switching tab"); }
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target?.files;
    const relativeDest = await getRelativePathForCommand(get(currentPath));
    if (relativeDest === null) return;
    await uploadFilesToCurrentPath(files, relativeDest, async () => {
      await refresh();
      if (target) target.value = '';
    });
  }

  async function onUpload() { fileInput?.click(); }

  async function onRename(name: string) {
    const parentAbsPath = get(currentPath);
    const relativePathForCommand = await getRelativePathForCommand(parentAbsPath);
    if (relativePathForCommand === null) return;
    openModal({
      title: `Rename "${name}"`, placeholder: "Enter new name", initialValue: name, confirmOnly: false,
      onSave: async (newName) => {
        if (!newName || newName === name) return;
        try { await renameEntry(relativePathForCommand, name, newName); toastStore.addToast(`Renamed "${name}" to "${newName}"`, "alert-info"); await refresh(); }
        catch (error) { /* Handled */ }
      }
    });
  }

  async function onDelete(name: string) {
    const parentAbsPath = get(currentPath);
    const relativePathForCommand = await getRelativePathForCommand(parentAbsPath);
    if (relativePathForCommand === null) return;
    openModal({
      title: `Delete "${name}"?`, message: `Permanently delete "${name}"?`, confirmOnly: true, confirmText: 'Delete', confirmClass: 'btn-error',
      onSave: async () => {
        try {
          await deleteEntry(relativePathForCommand, name); toastStore.addToast(`Deleted "${name}"`, "alert-warning"); await refresh();
          const mapsRootRelativePath = normalizePath(`${relativeBaseFolderConst}/Maps`);
          const deletedItemRelativePath = normalizePath(await join(relativePathForCommand, name));
           if (deletedItemRelativePath.startsWith(mapsRootRelativePath)) { await refreshLocalMaps(); }
        } catch (error) { /* Handled */ }
      }
    });
  }

  async function onNewFolder() {
    const parentAbsPath = get(currentPath);
    const relativePathForCommand = await getRelativePathForCommand(parentAbsPath);
    if (relativePathForCommand === null) return;
    openModal({
      title: "Create New Folder", placeholder: "Enter folder name", initialValue: "", confirmOnly: false,
      onSave: async (folderName) => {
        if (!folderName) return;
        try { await createFolder(relativePathForCommand, folderName); toastStore.addToast(`Folder "${folderName}" created`, "alert-success"); await refresh(); }
        catch (error) { /* Handled */ }
      }
    });
  }

  async function onNewFile() {
     const parentAbsPath = get(currentPath);
     const relativePathForCommand = await getRelativePathForCommand(parentAbsPath);
     if (relativePathForCommand === null) return;
     openModal({
      title: "Create New File", placeholder: "Enter file name", initialValue: "", confirmOnly: false,
      onSave: async (fileName) => {
        if (!fileName) return;
        try { await createFile(relativePathForCommand, fileName); toastStore.addToast(`File "${fileName}" created`, "alert-success"); await refresh(); }
        catch (error) { /* Handled */ }
      }
    });
  }

  async function openCurrentPathInExplorer() {
      const path = get(currentPath);
      if (!path || path.startsWith('/error')) { handleError("Current path is not available or invalid.", "Open Explorer"); return; }
      try {
          console.log(`Attempting to reveal path: ${path}`);
          await revealItemInDir(path); // <-- Use revealItemInDir
      } catch (error) {
          if (error instanceof Error && error.message.includes("permission")) {
             handleError("Permission denied. Check main-capability.json includes 'opener:allow-reveal-item-in-dir'", "Open Explorer");
          } else {
             handleError(error, `Failed to reveal path: ${path}`);
          }
      }
  }
</script>

<DropOverlay show={isDraggingOverZone} />

<div class="flex h-full">
  <TabSwitcher
    {tabs}
    currentPath={$currentPath}
    baseFolder={$absoluteBaseFolderPath}
    onSwitchTab={handleSwitchTab}
  />
  <div class="flex flex-col flex-1 w-full overflow-hidden p-4 space-y-4">
      <div class="flex justify-between items-center w-full flex-shrink-0">
        <div class="flex-grow overflow-hidden min-w-0 mr-4">
             <PathHeader currentPath={$currentPath} onGoBack={goUp} />
        </div>
        <div class="flex-shrink-0">
            <FileActions
              {onNewFolder}
              {onNewFile}
              {onUpload}
              onOpenExplorer={openCurrentPathInExplorer} 
            />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto rounded-box">
        <FileList
            entries={$entries}
            loading={$isLoading}
            onOpenDirectory={explorerStore.openDirectory}
            onRename={onRename}
            onDelete={onDelete}
        />
      </div>
      <input type="file" multiple bind:this={fileInput} on:change={handleFileChange} class="hidden" />
  </div>
</div>
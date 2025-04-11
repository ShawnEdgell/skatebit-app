<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import { uploadFilesToCurrentPath } from '$lib/utils/useFileUpload';
  import { baseFolder, handleDroppedPaths } from '$lib';
  import { explorerStore } from '$lib/stores/explorerStore';
  import { TabSwitcher, FileList, PathHeader, FileActions } from './components';
  import DropOverlay from '$lib/components/DropOverlay.svelte';
  import { explorerTabs as tabs } from './tabs';
  import { normalizePath } from '$lib/ts/pathUtils';
  
  // Use the global modal store (ModalManager will be rendered in the main layout)
  import { modalStore } from "$lib/stores/modalStore";

  const {
    currentPath,
    entries,
    isLoading,
    refresh,
    setPath,
    openDirectory,
    goUp
  } = explorerStore;

  let fileInput: HTMLInputElement;
  let isDraggingOverZone = false;
  let unlisten: (() => void) | null = null;

  function handleSwitchTab(subfolder: string) {
    const fullPath = normalizePath(`${baseFolder}/${subfolder}`);
    setPath(fullPath);
    refresh();
  }

  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target?.files;
    await uploadFilesToCurrentPath(files, get(currentPath), async () => {
      await refresh();
      if (target) target.value = '';
    });
  }

  async function handleUpload() {
    fileInput?.click();
  }

  onMount(async () => {
    await tick();
    await refresh();
    unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
      const payload = event.payload;
      switch (payload.type) {
        case 'over':
          isDraggingOverZone = true;
          break;
        case 'drop':
          if ('paths' in payload && payload.paths?.length > 0) {
            try {
              await handleDroppedPaths(payload.paths, get(currentPath));
              await refresh();
            } catch (error) {
              console.error('Drop Handle Error:', error);
            }
          }
          isDraggingOverZone = false;
          break;
        case 'leave':
          isDraggingOverZone = false;
          break;
      }
    });
  });

  onDestroy(() => {
    unlisten?.();
  });

  // --- Global CRUD Trigger Functions ---
  function onRename(name: string) {
    modalStore.set({
      open: true,
      type: "crud",
      props: {
        action: "rename",
        currentPath: get(currentPath),
        currentName: name
      }
    });
  }
  function onDelete(name: string) {
    modalStore.set({
      open: true,
      type: "crud",
      props: {
        action: "delete",
        currentPath: get(currentPath),
        currentName: name
      }
    });
  }
  function onNewFolder() {
    modalStore.set({
      open: true,
      type: "crud",
      props: {
        action: "newFolder",
        currentPath: get(currentPath),
        currentName: ""
      }
    });
  }
  function onNewFile() {
    modalStore.set({
      open: true,
      type: "crud",
      props: {
        action: "newFile",
        currentPath: get(currentPath),
        currentName: ""
      }
    });
  }
</script>

<div class="space-y-4 w-full">
  <TabSwitcher {tabs} currentPath={$currentPath} baseFolder={baseFolder} onSwitchTab={handleSwitchTab} />
  <PathHeader currentPath={$currentPath} baseFolder={baseFolder} onGoBack={goUp} />
  <FileList
    entries={$entries}
    loading={$isLoading}
    onOpenDirectory={openDirectory}
    onRename={(e) => onRename(e)}    
    onDelete={(e) => onDelete(e)}
  />
  <input type="file" multiple bind:this={fileInput} on:change={handleFileChange} class="hidden" />
  <FileActions onNewFolder={onNewFolder} onNewFile={onNewFile} onUpload={handleUpload} />
</div>

<DropOverlay show={isDraggingOverZone} />

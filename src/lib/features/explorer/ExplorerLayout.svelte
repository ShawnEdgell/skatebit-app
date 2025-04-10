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

  const {
    currentPath,
    entries,
    isLoading,
    refresh,
    setPath,
    openDirectory,
    goUp,
    newFolder,
    newFile,
    rename,
    delete: deleteEntry
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
      const isInside = true;

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
</script>

<div class="space-y-4 w-full">
  <TabSwitcher
    {tabs}
    currentPath={$currentPath}
    baseFolder={baseFolder}
    onSwitchTab={handleSwitchTab}
  />

  <PathHeader
    currentPath={$currentPath}
    baseFolder={baseFolder}
    onGoBack={goUp}
  />

  <FileList
    entries={$entries}
    loading={$isLoading}
    onOpenDirectory={openDirectory}
    onRename={rename}
    onDelete={deleteEntry}
  />

  <input type="file" multiple bind:this={fileInput} on:change={handleFileChange} class="hidden" />
  <FileActions onNewFolder={newFolder} onNewFile={newFile} onUpload={handleUpload} />
</div>

<DropOverlay show={isDraggingOverZone} />

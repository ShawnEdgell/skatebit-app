<!-- src/lib/components/FileActions.svelte -->
<script lang="ts">
  export let onNewFolder: () => void;
  export let onNewFile: () => void;
  export let onUpload: () => void;
  export let onOpenExplorer: () => void;
</script>

<div class="flex flex-wrap gap-2 w-full items-center">
   <button
    class="btn btn-ghost btn-xs btn-square text-base-content/80 tooltip tooltip-bottom"
    data-tip="Open Folder"
    aria-label="Open current folder in File Explorer"
    on:click={onOpenExplorer}
  >
     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V10.5m-4.5 0V6.75A2.25 2.25 0 0 0 14.25 4.5H9.75A2.25 2.25 0 0 0 7.5 6.75v1.5" />
     </svg>
  </button>

  <button
    class="btn btn-ghost btn-xs btn-square text-success tooltip tooltip-bottom"
    data-tip="New Folder" aria-label="Create New Folder" on:click={onNewFolder} >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>
  </button>

  <button
    class="btn btn-ghost btn-xs btn-square text-info tooltip tooltip-bottom"
    data-tip="New File" aria-label="Create New File" on:click={onNewFile} >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
  </button>

  <button
    class="btn btn-ghost btn-xs btn-square text-base-content tooltip tooltip-bottom"
    data-tip="Upload" aria-label="Upload Files" on:click={onUpload} >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
  </button>


</div>
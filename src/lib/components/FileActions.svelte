<script lang="ts">
  export let onNewFolder: () => void;
  export let onNewFile: () => void;
  export let onUpload: () => void;
</script>

<div class="flex flex-wrap gap-2">
  <button class="btn btn-success btn-xs" on:click={onNewFolder}>📁 New Folder</button>
  <button class="btn btn-info btn-xs" on:click={onNewFile}>📄 New File</button>
  <button class="btn btn-outline btn-xs" on:click={onUpload}>📤 Upload File</button>
</div>
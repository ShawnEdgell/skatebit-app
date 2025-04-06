<!-- src/components/PathHeader.svelte -->
<script lang="ts">
  export let currentPath: string;
  export let baseFolder: string;
  export let onGoBack: () => void;
</script>

<div class="flex items-center space-x-2 ">
  <button class="btn btn-soft btn-xs" on:click={onGoBack} disabled={currentPath === baseFolder}>
    Go Back
  </button>
  <h3 class="text-lg font-semibold">📂 {currentPath}</h3>
</div>

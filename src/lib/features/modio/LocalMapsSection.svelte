<!-- src/lib/components/LocalMapSection.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { localMapsStore, localMapsInitialized, refreshLocalMaps } from '$lib/stores/localMaps';
  import { get } from 'svelte/store';
  import LocalMapList from './components/LocalMapList.svelte';

  let localMaps = [];
  let isLoading = false;

  onMount(async () => {
    isLoading = true;
    try {
      if (!get(localMapsInitialized)) {
        await refreshLocalMaps();
      }
    } finally {
      isLoading = false;
    }
  });

  $: localMaps = $localMapsStore;
</script>

<LocalMapList {localMaps} />
{#if isLoading}
  <div class="flex items-center justify-center">
    <span class="loading loading-spinner loading-lg mt-4"></span>
  </div>
{/if}

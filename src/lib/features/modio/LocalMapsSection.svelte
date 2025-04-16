<!-- src/lib/features/modio/LocalMapsSection.svelte -->
<script lang="ts">
  import { localMaps } from '$lib/stores/mapsStore';
  import LocalMapList from '$lib/features/modio/components/LocalMapList.svelte';
  import type { FsEntry } from '$lib/types/fsTypes'; // Import FsEntry

  // --- Declare the variable with its type ---
  let mapsForList: FsEntry[] = [];

  // --- Assign it reactively (no type annotation here) ---
  $: mapsForList = $localMaps;

</script>

<!-- Pass the correctly typed variable -->
<LocalMapList localMapsProp={mapsForList} />
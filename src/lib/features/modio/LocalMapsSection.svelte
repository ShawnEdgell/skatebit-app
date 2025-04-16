<!-- src/lib/features/modio/LocalMapsSection.svelte -->
<script lang="ts">
  // No need to import or handle localMaps here anymore,
  // as LocalMapList reads the store directly.
  import LocalMapList from '$lib/features/modio/components/LocalMapList.svelte';
</script>

<!-- Render the component without passing the prop -->
<LocalMapList />
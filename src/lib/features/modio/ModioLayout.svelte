<script lang="ts">
  import DropZone from '$lib/components/DropZone.svelte';
  import ModioSection from './ModioSection.svelte';
  import LocalMapsSection from './LocalMapsSection.svelte';
  import { onMount } from 'svelte';
  import { refreshLocalMaps } from '$lib/stores/localMapsStore';
  import { modioStore } from '$lib/stores/modioStore';

  onMount(() => {
    modioStore.refresh();
    refreshLocalMaps();
  });
</script>

<DropZone />

<main class="mx-auto w-full flex flex-col space-y-6">
  <ModioSection />
  <LocalMapsSection />
</main>

<script lang="ts">
  import DropZone from '$lib/components/DropZone.svelte';
  import ModioSection from './ModioSection.svelte';
  import LocalMapsSection from './LocalMapsSection.svelte';
</script>

<DropZone />

<main class="mx-auto w-full flex flex-col gap-4 px-4 bg-base-300 h-full">
  <div class="bg-base-100 p-4 rounded-box shadow-md z-10">
    <ModioSection />
  </div>
  <div class="bg-base-100 p-4 rounded-box shadow-md z-10">
    <LocalMapsSection />
  </div>
</main>

<script lang="ts">
    import "../app.css";
    import NavBar from "$lib/components/NavBar.svelte";
    import Toast from "$lib/components/Toast.svelte";
    import { onMount } from 'svelte';
    import { initializeLocalMapsWatcher } from '$lib/stores/localMaps';

    onMount(async () => {
    await initializeLocalMapsWatcher();
  });
</script>

<Toast />
<NavBar />
<div class="p-4">
    <slot />
</div>


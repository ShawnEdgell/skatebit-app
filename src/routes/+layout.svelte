<script lang="ts">
  import "../app.css";
  import NavBar from "$lib/components/NavBar.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import ModalManager from "$lib/components/ModalManager.svelte"; 
  import { onMount } from 'svelte';
  import { initializeLocalMapsWatcher } from "$lib/stores/localMapsStore";

  onMount(async () => {
    await initializeLocalMapsWatcher();
  });
</script>

<Toast />
<NavBar />
<ModalManager />
<div class="p-4">
  <slot />
</div>

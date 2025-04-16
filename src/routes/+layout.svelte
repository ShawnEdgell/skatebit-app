<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  import NavBar from '$lib/components/NavBar.svelte';
  import CrudModal from '$lib/components/CrudModal.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import Updater from '$lib/components/Updater.svelte';
  import { onMount } from 'svelte';
  import { refreshLocalMaps, refreshModioMaps } from '$lib/stores/mapsStore';

  // Import the initialization functions from globalPathsStore.
  import { initializeGlobalPaths, initializeExplorerPaths } from '$lib/stores/globalPathsStore';
  // Import the explorer store initializer.
  import { initializeStore as initializeExplorerStore } from '$lib/stores/explorerStore';
  // Import the local maps watcher initializer from mapsStore.
  import { initializeLocalMapsWatcher } from '$lib/stores/mapsStore';

  let watcherUnlisten: (() => void) | null = null;
  let isBooting = true;

  onMount(() => {
    const initializeApp = async () => {
      try {
        console.log("Layout onMount: Initializing maps folder store...");
        await initializeGlobalPaths(); // Sets mapsDirectory for the maps feature.
        console.log("Layout onMount: Maps folder store initialized.");

        console.log("Layout onMount: Initializing explorer paths...");
        await initializeExplorerPaths(); // Sets explorerDirectory for the explorer feature.
        console.log("Layout onMount: Explorer paths initialized.");

        console.log("Layout onMount: Initializing explorer store...");
        await initializeExplorerStore(); // Initializes the explorer store with explorerDirectory.
        console.log("Layout onMount: Explorer store initialized.");

        console.log("Layout onMount: Initializing local maps watcher...");
        watcherUnlisten = await initializeLocalMapsWatcher();
        console.log("Layout onMount: Local maps watcher initialized.");
      } catch (error) {
        console.error('Error during app initialization:', error);
      }
    };
    refreshModioMaps();
    refreshLocalMaps();
    initializeApp();

    return () => {
      if (watcherUnlisten) {
        console.log('Layout unmounting: Cleaning up local maps watcher...');
        watcherUnlisten();
        watcherUnlisten = null;
      }
    };
  });
</script>

<CrudModal />
<Updater />
<Toast />

<NavBar />
<slot />

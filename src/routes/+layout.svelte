<script lang="ts">
  import "../app.css"; // Or app.pcss
  import NavBar from "$lib/components/NavBar.svelte";
  import CrudModal from "$lib/components/CrudModal.svelte";
  import Toast from "$lib/components/Toast.svelte"; // Or ToastContainer
  import { onMount } from 'svelte';
  import { initializeLocalMapsWatcher } from "$lib/stores/localMapsStore";

  let watcherUnlisten: (() => void) | null = null;

  onMount(() => {
    // Define an async function to do the initialization
    const startWatcher = async () => {
      try {
        // Await inside this separate async function
        watcherUnlisten = await initializeLocalMapsWatcher();
      } catch (error) {
          console.error("Error initializing local maps watcher:", error);
          // Handle error appropriately, maybe show a toast
      }
    };

    // Call the async function but don't await it here
    startWatcher();

    // Return the synchronous cleanup function
    // This function will be called when the component unmounts
    return () => {
      if (watcherUnlisten) {
        console.log("Layout unmounting: Cleaning up local maps watcher...");
        watcherUnlisten(); // Call the cleanup function returned by initializeLocalMapsWatcher
        watcherUnlisten = null; // Clear the reference
      }
    };
  });
</script>

<Toast /> 
<NavBar />
<CrudModal />
<slot />
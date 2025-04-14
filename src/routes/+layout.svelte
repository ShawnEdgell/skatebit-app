<script lang="ts">
	import '../app.css';
	import NavBar from '$lib/components/NavBar.svelte';
	import CrudModal from '$lib/components/CrudModal.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { onMount } from 'svelte';
	import { initializeLocalMapsWatcher } from '$lib/stores/localMapsStore';
	import Updater from '$lib/components/Updater.svelte';
	// Maps folder store is imported but initialize is NOT called here anymore
	import { mapsFolder } from '$lib/stores/mapsFolderStore';

	let watcherUnlisten: (() => void) | null = null;

	onMount(() => {
		const initializeApp = async () => {
			try {
				// --- REMOVED mapsFolder.initialize() ---
				// console.log("Layout onMount: Initializing maps folder store...");
				// await mapsFolder.initialize(); // REMOVE THIS LINE
                // console.log("Layout onMount: Maps folder store initialized.");
                // --- END REMOVAL ---

				console.log("Layout onMount: Initializing local maps watcher...");
				watcherUnlisten = await initializeLocalMapsWatcher();
				console.log("Layout onMount: Local maps watcher initialized.");

			} catch (error) {
				console.error('Error during app initialization:', error);
			}
		};

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

<Updater />
<Toast />
<NavBar />
<CrudModal />
<slot />
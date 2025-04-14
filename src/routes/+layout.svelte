<script lang="ts">
	import '../app.css';
	import NavBar from '$lib/components/NavBar.svelte';
	import CrudModal from '$lib/components/CrudModal.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { onMount } from 'svelte';
	import { initializeLocalMapsWatcher } from '$lib/stores/localMapsStore';
	import { mapsFolder } from '$lib/stores/mapsFolderStore'; 
	import { initializeExplorerStore } from '$lib/stores/explorerStore';
	import Updater from '$lib/components/Updater.svelte';

	let watcherUnlisten: (() => void) | null = null;

	onMount(() => {
		const initializeApp = async () => {
			try {
				console.log("Layout onMount: Initializing maps folder store...");
				await mapsFolder.initialize(); 
				console.log("Layout onMount: Maps folder store initialized.");

                console.log("Layout onMount: Initializing explorer store...");
				await initializeExplorerStore();
                console.log("Layout onMount: Explorer store initialized.");

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

<CrudModal />
<Updater />
<Toast />

<NavBar />
<slot />

<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css'
  import NavBar from '$lib/components/NavBar.svelte'
  import CrudModal from '$lib/components/CrudModal.svelte'
  import Toast from '$lib/components/Toast.svelte'
  import Updater from '$lib/components/Updater.svelte'
  import { onMount, onDestroy } from 'svelte'
  import {
    initializeGlobalPaths,
    initializeExplorerPaths,
  } from '$lib/stores/globalPathsStore'
  import {
    initializeLocalMapsWatcher,
    refreshLocalMaps,
    refreshModioMaps,
  } from '$lib/stores/mapsStore'

  let unlisten: () => void

  onMount(async () => {
    // Step 1: Load & persist user paths
    await initializeGlobalPaths()
    await initializeExplorerPaths()

    // Step 2: One‑time initial loads
    await refreshModioMaps()
    await refreshLocalMaps()

    // Step 3: Watch for any maps‑changed events and refresh only local maps
    unlisten = await initializeLocalMapsWatcher()
  })

  onDestroy(() => {
    unlisten?.()
  })
</script>

<CrudModal />
<Updater />
<Toast />

<NavBar />
<slot />

<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css'
  import { onMount, onDestroy } from 'svelte'
  import NavBar from '$lib/components/NavBar.svelte'
  import CrudModal from '$lib/components/CrudModal.svelte'
  import Toast from '$lib/components/Toast.svelte'
  import Updater from '$lib/components/Updater.svelte'

  // 1) Path setup
  import {
    initializeGlobalPaths,
    initializeExplorerPaths,
  } from '$lib/stores/globalPathsStore'

  // 2) Maps: remote + local (auto‑refresh lives in the store)
  import { refreshModioMaps, refreshLocalMaps } from '$lib/stores/mapsStore'

  // 3) Explorer
  import { refreshExplorer, watchExplorer } from '$lib/stores/explorerStore'

  let unlistenExplorer: () => void

  onMount(async () => {
    // Bootstrap all of your base paths
    await initializeGlobalPaths()
    await initializeExplorerPaths()

    // One‑time fetches
    await refreshModioMaps()
    await refreshLocalMaps()
    await refreshExplorer()

    // fire up the explorer FS watcher
    unlistenExplorer = await watchExplorer()
  })

  onDestroy(() => {
    unlistenExplorer?.()
  })
</script>

<CrudModal />
<Updater />
<Toast />

<NavBar />
<slot />

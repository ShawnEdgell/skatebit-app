<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css'
  import { onMount, onDestroy } from 'svelte'
  import { handleError } from '$lib/utils/errorHandler'

  import NavBar from '$lib/components/NavBar.svelte'
  import CrudModal from '$lib/components/CrudModal.svelte'
  import Toast from '$lib/components/Toast.svelte'
  import Updater from '$lib/components/Updater.svelte'
  import GlobalDropOverlay from '$lib/components/GlobalDropOverlay.svelte'

  // DnD
  import {
    isDraggingOver,
    activeDropTargetInfo,
    attachGlobalDropListener,
    detachGlobalDropListener,
  } from '$lib/stores/dndStore'

  // Path setup
  import {
    initializeGlobalPaths,
    initializeExplorerPaths,
  } from '$lib/stores/globalPathsStore'

  // Explorer
  import { refreshExplorer } from '$lib/stores/explorerStore'

  // Mod.io maps
  import { refreshModioMaps } from '$lib/stores/mapsStore'

  onMount(async () => {
    try {
      await initializeGlobalPaths()
      await initializeExplorerPaths()
      await refreshExplorer()
      await attachGlobalDropListener()
    } catch (err: any) {
      handleError(err, '[Layout] Initialization Error')
    }

    // kick off remote‐maps load in background
    refreshModioMaps().catch((err: any) =>
      handleError(err, '[Layout] Loading Mod.io Maps'),
    )
  })

  onDestroy(() => {
    detachGlobalDropListener()
  })
</script>

<CrudModal />
<Toast />
<GlobalDropOverlay show={$isDraggingOver} targetInfo={$activeDropTargetInfo} />

<Updater />
<NavBar />
<slot />

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

  // Explorer (we *do* await this)
  import { refreshExplorer, watchExplorer } from '$lib/stores/explorerStore'

  // Mod.io maps (we defer this)
  import { refreshModioMaps } from '$lib/stores/mapsStore'

  let unlistenExplorer: (() => void) | null = null

  onMount(async () => {
    try {
      console.log('[Layout] Bootstrapping paths…')
      await initializeGlobalPaths()
      await initializeExplorerPaths()

      console.log('[Layout] Loading file‑explorer view…')
      await refreshExplorer()

      console.log('[Layout] Attaching FS watchers…')
      unlistenExplorer = await watchExplorer()

      console.log('[Layout] Attaching drag & drop listener…')
      await attachGlobalDropListener()
    } catch (err) {
      handleError(err, '[Layout] Initialization Error')
    }

    // **NOW** fetch mod.io maps in the background
    // (no await, so any failures don’t hold up the UI)
    refreshModioMaps().catch((err) =>
      handleError(err, '[Layout] Loading Mod.io Maps'),
    )
  })

  onDestroy(() => {
    unlistenExplorer?.()
    detachGlobalDropListener()
  })
</script>

<CrudModal />
<Toast />
<GlobalDropOverlay show={$isDraggingOver} targetInfo={$activeDropTargetInfo} />

<Updater />
<NavBar />
<slot />

<script lang="ts">
  import '../app.css'
  import { onMount, onDestroy } from 'svelte'
  import { handleError } from '$lib/utils/errorHandler'
  import { listen } from '@tauri-apps/api/event'
  import { downloadProgress } from '$lib/stores/downloadProgressStore'
  import type { InstallationProgress } from '$lib/types/downloadTypes'

  import NavBar from '$lib/components/NavBar.svelte'
  import CrudModal from '$lib/components/CrudModal.svelte'
  import Toast from '$lib/components/Toast.svelte'
  import ToastManager from '$lib/components/ToastManager.svelte'
  import Updater from '$lib/components/Updater.svelte'
  import GlobalDropOverlay from '$lib/components/GlobalDropOverlay.svelte'

  import {
    isDraggingOver,
    activeDropTargetInfo,
    attachGlobalDropListener,
    detachGlobalDropListener,
  } from '$lib/stores/dndStore'

  import {
    initializeGlobalPaths,
    initializeExplorerPaths,
  } from '$lib/stores/globalPathsStore'

  import { refreshExplorer } from '$lib/stores/explorerStore'
  import { refreshModioMaps } from '$lib/stores/mapsStore'

  let unlistenInstallation: () => void

  onMount(async () => {
    try {
      await initializeGlobalPaths()
      await initializeExplorerPaths()
      await refreshExplorer()
      await attachGlobalDropListener()

      refreshModioMaps().catch((err) =>
        handleError(err, '[Layout] Loading Mod.io Maps'),
      )

      unlistenInstallation = await listen<InstallationProgress>(
        'installation_progress',
        (event) => {
          const { source, step, progress, message } = event.payload

          // ✅ Preserve label (mod name) if it was already added earlier
          downloadProgress.update((prev) => ({
            ...prev,
            [source]: {
              ...prev[source],
              step,
              progress,
              message,
              source,
            },
          }))

          // Auto-cleanup after done
          if (step === 'complete' || step === 'error') {
            setTimeout(() => {
              downloadProgress.update((prev) => {
                const next = { ...prev }
                delete next[source]
                return next
              })
            }, 5000)
          }
        },
      )
    } catch (err: any) {
      handleError(err, '[Layout] Initialization Error')
    }
  })

  onDestroy(() => {
    detachGlobalDropListener()
    if (unlistenInstallation) unlistenInstallation()
    downloadProgress.set({})
  })
</script>

<CrudModal />
<Toast />
<ToastManager />
<GlobalDropOverlay show={$isDraggingOver} targetInfo={$activeDropTargetInfo} />
<Updater />
<NavBar />
<slot />

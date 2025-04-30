<script lang="ts">
  import '../app.css'
  import { get } from 'svelte/store'
  import { onMount, onDestroy } from 'svelte'
  import { handleError } from '$lib/utils/errorHandler'
  import { listen } from '@tauri-apps/api/event'
  import { invoke } from '@tauri-apps/api/core'
  import { downloadProgress } from '$lib/stores/downloadProgressStore'
  import { mapsDirectory } from '$lib/stores/globalPathsStore'
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
    explorerDirectory,
  } from '$lib/stores/globalPathsStore'

  import { setPath } from '$lib/stores/explorerStore'
  import { refreshModioMaps } from '$lib/stores/mapsStore'

  let unlistenInstallation: () => void
  let unsubscribeWatch: () => void

  onMount(async () => {
    try {
      await initializeGlobalPaths()
      await initializeExplorerPaths()

      const base = get(explorerDirectory)
      if (base) {
        await setPath(base)
      }

      await attachGlobalDropListener()
      refreshModioMaps().catch((e) =>
        handleError(e, '[Layout] Loading Mod.io Maps'),
      )

      unsubscribeWatch = mapsDirectory.subscribe((dir) => {
        if (dir && !dir.startsWith('/error')) {
          invoke('add_watched_path', { path: dir }).catch((e) =>
            handleError(e, '[Layout] add_watched_path'),
          )
        }
      })

      unlistenInstallation = await listen<InstallationProgress>(
        'installation_progress',
        (event) => {
          const { source, step, progress, message } = event.payload
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
    } catch (e: any) {
      handleError(e, '[Layout] Initialization Error')
    }
  })

  onDestroy(() => {
    detachGlobalDropListener()
    if (unlistenInstallation) unlistenInstallation()
    if (unsubscribeWatch) unsubscribeWatch()
    downloadProgress.set({})
  })
</script>

<CrudModal />
<Toast />
<ToastManager />
<GlobalDropOverlay show={$isDraggingOver} targetInfo={$activeDropTargetInfo} />

<Updater />

<div class="flex h-screen flex-col">
  <NavBar />
  <div class="h-full overflow-hidden">
    <slot />
  </div>
</div>

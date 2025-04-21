<script lang="ts">
  // --- Base Imports ---
  import '../app.css'
  import { get } from 'svelte/store'
  import { onMount, onDestroy } from 'svelte'
  import { handleError } from '$lib/utils/errorHandler'

  // --- Tauri API Imports ---
  import {
    listen,
    type Event as TauriEvent,
    type UnlistenFn,
  } from '@tauri-apps/api/event' // Added UnlistenFn
  import { invoke } from '@tauri-apps/api/core'
  import { TrayIcon, type TrayIconEvent } from '@tauri-apps/api/tray'
  import { Menu } from '@tauri-apps/api/menu'
  import { defaultWindowIcon } from '@tauri-apps/api/app'
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
  import { exit } from '@tauri-apps/plugin-process' // Using Plugin

  // --- Store Imports ---
  import { downloadProgress } from '$lib/stores/downloadProgressStore'
  import {
    mapsDirectory,
    initializeGlobalPaths,
    initializeExplorerPaths,
    explorerDirectory,
  } from '$lib/stores/globalPathsStore'
  import { setPath } from '$lib/stores/explorerStore'
  import { refreshModioMaps } from '$lib/stores/mapsStore'
  import {
    attachGlobalDropListener,
    detachGlobalDropListener,
    isDraggingOver,
    activeDropTargetInfo,
  } from '$lib/stores/dndStore'

  // --- Type Imports ---
  import type { InstallationProgress } from '$lib/types/downloadTypes'

  // --- Component Imports ---
  import NavBar from '$lib/components/NavBar.svelte'
  import CrudModal from '$lib/components/CrudModal.svelte'
  import Toast from '$lib/components/Toast.svelte'
  import ToastManager from '$lib/components/ToastManager.svelte'
  import Updater from '$lib/components/Updater.svelte'
  import GlobalDropOverlay from '$lib/components/GlobalDropOverlay.svelte'

  // --- State Variables ---
  let appTray: TrayIcon | null = null
  let unlistenInstallation: UnlistenFn | null = null
  let unsubscribeWatch: () => void
  let unlistenCloseRequested: UnlistenFn | null = null

  onMount(async () => {
    try {
      // --- Original Initialization Logic ---
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
            [source]: { ...prev[source], step, progress, message, source },
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
      // --- End Original Initialization Logic ---

      // --- Setup Hide on Close Listener ---
      try {
        // FIX 1: Await the getByLabel call
        const mainWindow = await WebviewWindow.getByLabel('main')
        if (mainWindow) {
          // FIX 2: Add type annotation for event object
          unlistenCloseRequested = await mainWindow.onCloseRequested(
            async (event: { preventDefault: () => void }) => {
              console.log('[Layout] Close requested, hiding window instead.')
              event.preventDefault() // Prevent the window from closing
              // FIX 1 (cont.): Now you can call methods on the resolved mainWindow instance
              await mainWindow.hide()
            },
          )
          console.log('[Layout] Hide on close listener attached.')
        } else {
          console.error(
            '[Layout] Could not attach close listener: Main window not found.',
          )
          handleError(
            'Main window not found for close listener',
            'Window Setup',
          )
        }
      } catch (err) {
        handleError(err, '[Layout] Failed to set up hide-on-close listener')
      }
      // --- End Hide on Close Setup ---

      // --- Initialize System Tray ---
      try {
        console.log('[Layout] Initializing system tray...')
        const showMainWindow = async () => {
          try {
            // FIX 1 (also applies here): Await getByLabel
            const windowInstance = await WebviewWindow.getByLabel('main')
            if (windowInstance) {
              await windowInstance.show()
              await windowInstance.unminimize()
              await windowInstance.setFocus()
            } else {
              handleError('Main window not found', 'Window Operation')
            }
          } catch (err) {
            handleError(err, 'Failed to show main window')
          }
        }
        const quitApp = async () => {
          /* ... quit app logic ... */
          console.log('[Layout] Quit action triggered via tray')
          await exit(0)
        }
        const trayMenu = await Menu.new({
          /* ... menu items ... */
          items: [
            {
              id: 'show',
              text: 'Show XL File Manager',
              action: showMainWindow,
            },
            { id: 'quit', text: 'Quit', action: quitApp },
          ],
        })
        const fetchedIcon = await defaultWindowIcon()
        let iconSource:
          | typeof fetchedIcon
          | string
          | Uint8Array
          | ArrayBuffer
          | undefined
        if (fetchedIcon !== null) {
          iconSource = fetchedIcon
        } else {
          iconSource = undefined
        }
        const trayOptions = {
          tooltip: 'XL File Manager',
          icon: iconSource,
          menu: trayMenu,
          menuOnLeftClick: false,
        }
        appTray = await TrayIcon.new(trayOptions)
        console.log('[Layout] System tray initialized successfully.')
      } catch (trayError) {
        handleError(trayError, '[Layout] System tray failed to initialize')
      }
      // --- System Tray Initialization Complete ---
    } catch (e: any) {
      handleError(e, '[Layout] Initialization Error')
    }
  })

  onDestroy(() => {
    // --- Original Cleanup ---
    detachGlobalDropListener()
    if (unlistenInstallation) unlistenInstallation()
    if (unsubscribeWatch) unsubscribeWatch()
    downloadProgress.set({})

    // --- Cleanup close listener ---
    if (unlistenCloseRequested) {
      console.log('[Layout] Detaching close requested listener.')
      unlistenCloseRequested()
    }

    // --- No dispose call needed for appTray ---
    console.log('[Layout] onDestroy cleanup complete.')
  })
</script>

<CrudModal />
<Toast />
<ToastManager />
<GlobalDropOverlay show={$isDraggingOver} targetInfo={$activeDropTargetInfo} />
<Updater />

<div class="flex h-screen flex-col">
  <NavBar />
  <div class="flex-1">
    <slot />
  </div>
</div>

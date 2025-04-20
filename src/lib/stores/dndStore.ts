// src/lib/stores/dndStore.ts
import { writable, get } from 'svelte/store'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { handleDroppedPaths } from '$lib/services/dragDropService' // Service doing the actual file processing
import { handleError } from '$lib/utils/errorHandler'
import { refreshExplorer } from '$lib/stores/explorerStore' // Import necessary refreshers
import { refreshLocalMaps } from '$lib/stores/mapsStore'
import { browser } from '$app/environment' // Import browser check

// --- Exported Stores ---
export const isDraggingOver = writable(false)

// Use writable store so layouts/FolderSelector can set the active target
export const activeDropTargetInfo = writable<{
  path: string | null
  label: string | null
}>({ path: null, label: null })

// --- Listener Management Logic ---

let currentUnlistenFn: (() => void) | null = null // Store the unlisten function from Tauri

// Function to handle the actual event logic
async function dragDropEventHandler(
  event: any /* Consider finding specific Tauri event type if 'any' causes issues */,
): Promise<void> {
  if (!browser) return // Ensure browser context

  const payload = event.payload
  isDraggingOver.set(payload.type === 'over') // Update overlay state

  if (payload.type === 'drop') {
    const paths = payload.paths
    const targetInfo = get(activeDropTargetInfo) // Get target info AT DROP TIME

    if (paths && paths.length > 0) {
      if (!targetInfo.path) {
        handleError(
          'Cannot handle drop: No active target path set.',
          'File Drop',
        )
        isDraggingOver.set(false)
        return
      }
      try {
        console.log(
          `[DND Store Drop] Dropping ${paths.length} item(s) onto '${targetInfo.label || targetInfo.path}' at: ${targetInfo.path}`,
        )
        const result = await handleDroppedPaths(paths, targetInfo.path)

        if (result.success > 0) {
          console.log('[DND Store Drop] Success, triggering refresh(es)...')
          // Refresh based on the target label
          if (targetInfo.label === 'Maps Folder') {
            console.log(
              '[DND Store Drop] Refreshing local maps list AND explorer...',
            )
            await refreshLocalMaps(targetInfo.path, 'DND Drop Event')
            await refreshExplorer(undefined, 'DND Drop Maps Target') // Refresh current explorer view too
          } else {
            // Assume other targets are handled by explorer refresh
            console.log('[DND Store Drop] Refreshing explorer...')
            await refreshExplorer(targetInfo.path, 'DND Drop Explorer Target')
          }
        } else {
          console.log('[DND Store Drop] No successful operations to refresh.')
        }
      } catch (error) {
        handleError(
          error,
          `Processing Dropped Files to ${targetInfo.label || targetInfo.path}`,
        )
      } finally {
        isDraggingOver.set(false)
      }
    } else {
      isDraggingOver.set(false)
    }
  } else if (payload.type === 'cancel') {
    console.log('[DND Store] Drop cancelled by user.')
  } else if (payload.type === 'leave') {
    console.log('[DND Store] Drag operation left window.')
  }
}

// --- Exported Listener Management Functions ---

/** Attaches the global drag-and-drop listener to the main webview. */
export async function attachGlobalDropListener(): Promise<void> {
  if (!browser) return
  if (currentUnlistenFn) {
    console.warn('[DND Store] Listener already attached. Skipping attach.')
    return
  }
  console.log('[DND Store] Attaching global drop listener...')
  try {
    const webview = getCurrentWebview()
    const unlisten = await webview.onDragDropEvent(dragDropEventHandler)
    currentUnlistenFn = unlisten
    console.log('[DND Store] Listener attached successfully.')
  } catch (error) {
    handleError(error, '[DND Store] Failed to attach drop listener')
    currentUnlistenFn = null
  }
}

/** Detaches the global drag-and-drop listener if it's currently active. */
export function detachGlobalDropListener(): void {
  if (!browser) return
  if (currentUnlistenFn) {
    console.log('[DND Store] Detaching global drop listener...')
    try {
      currentUnlistenFn()
    } catch (e) {
      console.error('[DND Store] Error calling unlisten function:', e)
    } finally {
      currentUnlistenFn = null
      console.log('[DND Store] Listener detached.')
    }
  } else {
    console.log('[DND Store] No active listener to detach.')
  }
}

/** Detaches any existing listener and attaches a new one. Useful after significant state changes. */
export async function reinitializeDropListener(): Promise<void> {
  if (!browser) return
  console.log('[DND Store] Re-initializing drop listener request received...')
  detachGlobalDropListener()
  await attachGlobalDropListener()
}

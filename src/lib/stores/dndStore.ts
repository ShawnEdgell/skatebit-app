// src/lib/stores/dndStore.ts
import { writable, get } from 'svelte/store'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { handleDroppedPaths } from '$lib/services/dragDropService'
import { handleError } from '$lib/utils/errorHandler'
import { refreshExplorer } from '$lib/stores/explorerStore'
import { refreshLocalMaps } from '$lib/stores/mapsStore'
import { browser } from '$app/environment'

// --- Drag Overlay State ---
export const isDraggingOver = writable(false)

// Active drop target (folder path + label)
export const activeDropTargetInfo = writable<{
  path: string | null
  label: string | null
}>({
  path: null,
  label: null,
})

let currentUnlistenFn: (() => void) | null = null

async function dragDropEventHandler(event: any): Promise<void> {
  if (!browser) return

  const payload = event.payload
  isDraggingOver.set(payload.type === 'over')

  if (payload.type === 'drop') {
    const paths: string[] = payload.paths
    const targetInfo = get(activeDropTargetInfo)

    if (!paths?.length || !targetInfo.path) {
      handleError('No files or target folder for drop.', 'File Drop')
      isDraggingOver.set(false)
      return
    }

    try {
      console.log(
        `[DND] Dropping ${paths.length} items onto ${targetInfo.path}`,
      )
      const { success } = await handleDroppedPaths(paths, targetInfo.path)

      if (success > 0) {
        console.log('[DND] Refreshing after drop…')
        if (targetInfo.label === 'Maps Folder') {
          await refreshLocalMaps()
          await refreshExplorer()
        } else {
          await refreshExplorer()
        }
      }
    } catch (e) {
      handleError(e, `Processing dropped files to ${targetInfo.path}`)
    } finally {
      isDraggingOver.set(false)
    }
  } else if (payload.type === 'leave' || payload.type === 'cancel') {
    isDraggingOver.set(false)
  }
}

export async function attachGlobalDropListener(): Promise<void> {
  if (!browser || currentUnlistenFn) return
  try {
    const webview = getCurrentWebview()
    currentUnlistenFn = await webview.onDragDropEvent(dragDropEventHandler)
    console.log('[DND] Listener attached')
  } catch (e) {
    handleError(e, '[DND] Failed to attach drop listener')
    currentUnlistenFn = null
  }
}

export function detachGlobalDropListener(): void {
  if (!browser || !currentUnlistenFn) return
  try {
    currentUnlistenFn()
    console.log('[DND] Listener detached')
  } catch (e) {
    handleError(e, '[DND] Error detaching listener')
  } finally {
    currentUnlistenFn = null
  }
}

export async function reinitializeDropListener(): Promise<void> {
  if (!browser) return
  detachGlobalDropListener()
  await attachGlobalDropListener()
}

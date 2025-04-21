// src/lib/stores/dndStore.ts
import { writable, get } from 'svelte/store'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { handleDroppedPaths } from '$lib/services/dragDropService'
import { handleError } from '$lib/utils/errorHandler'
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

let unlistenDragDrop: (() => void) | null = null

async function dragDropEventHandler(event: any): Promise<void> {
  if (!browser) return

  const { type, paths } = event.payload
  isDraggingOver.set(type === 'over')

  if (type === 'drop') {
    const target = get(activeDropTargetInfo)
    isDraggingOver.set(false)

    if (!paths?.length || !target.path) {
      handleError('No files or target folder for drop.', 'File Drop')
      return
    }

    try {
      await handleDroppedPaths(paths, target.path)
      // FS watcher will detect and refresh stores automatically
    } catch (err) {
      handleError(err, `Processing drop on ${target.path}`)
    }
  }
}

export async function attachGlobalDropListener(): Promise<void> {
  if (!browser || unlistenDragDrop) return
  try {
    const webview = getCurrentWebview()
    unlistenDragDrop = await webview.onDragDropEvent(dragDropEventHandler)
  } catch (err) {
    handleError(err, '[DND] Failed to attach drop listener')
    unlistenDragDrop = null
  }
}

export function detachGlobalDropListener(): void {
  if (!browser || !unlistenDragDrop) return
  try {
    unlistenDragDrop()
  } catch (err) {
    handleError(err, '[DND] Error detaching listener')
  } finally {
    unlistenDragDrop = null
  }
}

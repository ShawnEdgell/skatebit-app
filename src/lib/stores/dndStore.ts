import { writable, get } from 'svelte/store'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { handleDroppedPaths } from '$lib/services/dragDropService'
import { handleError } from '$lib/utils/errorHandler'
import { browser } from '$app/environment'
import { mapsDirectory } from '$lib/stores/globalPathsStore'
import { refreshLocalMaps } from '$lib/stores/mapsStore'

export const isDraggingOver = writable(false)
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

      if (target.path === get(mapsDirectory)) {
        await refreshLocalMaps(target.path, 'drop')
      }
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
  unlistenDragDrop()
  unlistenDragDrop = null
}

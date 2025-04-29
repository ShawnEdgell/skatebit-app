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
  customMessage?: string | null
}>({
  path: null,
  label: null,
  customMessage: null,
})

// 🆕 NEW
export const customDropHandler = writable<
  ((paths: string[]) => Promise<void> | void) | null
>(null)
export const acceptedExtensions = writable<string[] | null>(null)

let unlistenDragDrop: (() => void) | null = null

async function dragDropEventHandler(event: any): Promise<void> {
  if (!browser) return

  const { type, paths } = event.payload
  isDraggingOver.set(type === 'over')

  if (type === 'drop') {
    const target = get(activeDropTargetInfo)
    const customHandler = get(customDropHandler)
    const extensions = get(acceptedExtensions)
    isDraggingOver.set(false)

    if (!paths?.length) {
      handleError('No files dropped.', 'File Drop')
      return
    }

    // 🆕 If extensions are required, validate
    if (extensions && extensions.length > 0) {
      const validPaths = paths.filter((path: string) =>
        extensions.some((ext) =>
          path.toLowerCase().endsWith(ext.toLowerCase()),
        ),
      )

      if (validPaths.length === 0) {
        handleError('No valid files dropped.', 'File Drop')
        return
      }
      paths.splice(0, paths.length, ...validPaths)
    }

    try {
      if (customHandler) {
        console.log('[DND] Using custom drop handler.')
        await customHandler(paths)
      } else if (target.path) {
        console.log('[DND] Using default path handler.')
        await handleDroppedPaths(paths, target.path)

        if (target.path === get(mapsDirectory)) {
          await refreshLocalMaps()
        }
      } else {
        console.warn('[DND] No target path or custom handler set.')
      }
    } catch (err) {
      handleError(err, `Processing drop`)
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

import { get } from 'svelte/store'
import { invoke } from '@tauri-apps/api/core'
import {
  skaterXLGamePath,
  saveSkaterXLGamePath,
  loadSkaterXLPath,
} from '$lib/stores/globalPathsStore'

export async function ensureSkaterXLPath() {
  const isTauri = '__TAURI__' in window
  if (!isTauri) {
    console.warn('[initSkaterXLPath] Not running in Tauri — skipping.')
    return
  }

  // Load any saved path first
  await loadSkaterXLPath()

  const currentPath = get(skaterXLGamePath)

  if (!currentPath || currentPath.trim() === '') {
    try {
      const path = await invoke<string>('find_skaterxl_path')
      if (path) {
        console.log('[initSkaterXLPath] Auto-detected:', path)
        await saveSkaterXLGamePath(path)
      } else {
        console.warn('[initSkaterXLPath] Could not auto-detect SkaterXL.')
      }
    } catch (err) {
      console.error('[initSkaterXLPath] Error auto-detecting SkaterXL', err)
    }
  }
}

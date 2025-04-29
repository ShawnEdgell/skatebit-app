import { get } from 'svelte/store'
import { invoke } from '@tauri-apps/api/core'
import {
  skaterXLGamePath,
  saveSkaterXLGamePath,
  loadSkaterXLPath,
} from '$lib/stores/globalPathsStore'

export async function ensureSkaterXLPath() {
  // Load any saved path first
  await loadSkaterXLPath()

  const currentPath = get(skaterXLGamePath) // 🔥 GET the actual value!

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

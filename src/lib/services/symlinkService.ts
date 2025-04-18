// src/lib/services/symlinkService.ts
import { invoke } from '@tauri-apps/api/core'
import { documentDir, join } from '@tauri-apps/api/path'
import { mapsDirectory } from '$lib/stores/globalPathsStore'

/**
 * Point the Documents/SkaterXL/Maps link at `newFolder`,
 * then update our mapsDirectory store so the UI responds immediately.
 */
export async function updateMapsSymlink(newFolder: string) {
  const docs = await documentDir()
  if (!docs) throw new Error('Could not determine Documents directory.')
  const targetLink = await join(docs, 'SkaterXL', 'Maps')

  await invoke('create_maps_symlink', {
    newFolder,
    targetLink,
  })

  // only update the mapsDirectory here:
  mapsDirectory.set(newFolder)
  console.log('Symbolic link updated successfully.')
}

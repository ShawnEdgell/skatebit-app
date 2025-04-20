import { invoke } from '@tauri-apps/api/core'
import { documentDir, join } from '@tauri-apps/api/path'
import { mapsDirectory } from '$lib/stores/globalPathsStore'

export async function updateMapsSymlink(newFolder: string) {
  const docs = await documentDir()
  if (!docs) throw new Error('Could not determine Documents directory.')
  const targetLink = await join(docs, 'SkaterXL', 'Maps')

  await invoke('create_maps_symlink', {
    newFolder,
    targetLink,
  })

  mapsDirectory.set(newFolder)
  console.log('Symbolic link updated successfully.')
}

import { invoke } from '@tauri-apps/api/core'
import { documentDir, join } from '@tauri-apps/api/path'
import { mapsDirectory, explorerDirectory } from '$lib/stores/globalPathsStore'
import { setPath } from '$lib/stores/explorerStore'
import { get } from 'svelte/store'

export async function updateMapsSymlink(newFolder: string) {
  const docs = await documentDir()
  if (!docs) throw new Error('Could not determine Documents directory.')
  const targetLink = await join(docs, 'SkaterXL', 'Maps')

  await invoke('create_maps_symlink', {
    newFolder,
    targetLink,
  })

  // 1. Update the store
  mapsDirectory.set(newFolder)

  // 2. Immediately tell explorer to re-watch the folder
  const current = get(explorerDirectory)
  if (current) {
    await setPath(current)
  }

  console.log('Symbolic link updated and explorer path refreshed.')
}

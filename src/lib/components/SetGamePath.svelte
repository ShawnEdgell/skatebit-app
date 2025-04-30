<!-- src/lib/components/SetGamePathButton.svelte -->
<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog'
  import {
    initializeGlobalPaths,
    setSkaterXLGamePath,
  } from '$lib/stores/globalPathsStore'
  import { refreshLocalMods } from '$lib/stores/modsStore'
  import { handleError } from '$lib/utils/errorHandler'

  async function handleSetPath() {
    try {
      const selected = await open({ directory: true })
      if (typeof selected === 'string') {
        await setSkaterXLGamePath(selected)
        await initializeGlobalPaths()
        await refreshLocalMods()
      }
    } catch (err) {
      handleError(err, 'Setting Game Path')
    }
  }
</script>

<button title="Change Game Folder" on:click={handleSetPath}>
  Change Game Folder
</button>

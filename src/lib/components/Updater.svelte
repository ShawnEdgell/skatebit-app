<!-- src/lib/components/Updater.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { check } from '@tauri-apps/plugin-updater'
  // If relaunch is not available, you can replace it with window.location.reload()
  import { relaunch } from '@tauri-apps/plugin-process'
  import { getVersion } from '@tauri-apps/api/app'
  import { writable } from 'svelte/store'

  interface UpdaterInfo {
    version: string
    date?: string
    body: string
    [key: string]: any
  }

  // Updater stores
  const updateAvailable = writable(false)
  const updateInfo = writable<UpdaterInfo>({ version: '', body: '' })
  const updateLog = writable<string>('')
  const currentVersion = writable('')

  onMount(async () => {
    try {
      // Retrieve the current app version from Tauri metadata.
      const v = await getVersion()
      currentVersion.set(v)

      // Check for update availability.
      const update = await check()
      updateLog.set('Update check completed.')
      if (update?.available) {
        updateInfo.set(update as UpdaterInfo)
        updateAvailable.set(true)
        updateLog.set(`Update available: v${(update as UpdaterInfo).version}`)
      } else {
        updateLog.set('Your app is up to date.')
      }
    } catch (error) {
      updateLog.set(`Error checking updates: ${error}`)
    }
  })

  async function updateNow() {
    try {
      const update = await check()
      if (update?.available) {
        updateLog.set(
          `Downloading update v${(update as UpdaterInfo).version}...`,
        )
        await update.downloadAndInstall()
        updateLog.set('Update installed. Restarting app...')
        await relaunch()
      }
    } catch (error) {
      updateLog.set(`Error updating: ${error}`)
    }
  }
</script>

{#if $updateAvailable}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Update Available!</h3>
      <p>
        A new update (v{$updateInfo.version}) is available!
        {#if $updateInfo.date}
          <br />Released on: {$updateInfo.date.substring(0, 10)}
        {/if}
      </p>
      <!-- <p class="mt-2">Release notes: {$updateInfo.body}</p> -->
      <div class="modal-action">
        <button class="btn btn-primary" on:click={updateNow}>Update Now</button>
        <button
          class="btn btn-secondary"
          on:click={() => updateAvailable.set(false)}>Cancel</button
        >
      </div>
    </div>
  </div>
{/if}

<!-- Footer showing the current version; in development, this may be a placeholder version -->
<footer
  class="fixed inset-x-0 bottom-0 p-4 text-xs text-base-content/40 font-semibold"
>
  Current Version: {$currentVersion}
</footer>

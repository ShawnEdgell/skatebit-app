<!-- src/lib/components/Updater.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { check, Update } from '@tauri-apps/plugin-updater'
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

  // --- Stores ---
  const updateAvailable = writable(false)
  const updateInfo = writable<UpdaterInfo>({ version: '', body: '' })
  const updateLog = writable<string>('')
  const currentVersion = writable('')

  // We'll stash the Update object here so downloadAndInstall() really runs.
  let currentUpdate: Update | null = null

  onMount(async () => {
    try {
      // 1) Get our app's version
      const v = await getVersion()
      currentVersion.set(v)

      // 2) Check once for updates
      updateLog.set('Checking for updates…')
      const upd = await check()
      updateLog.set('Update check completed.')

      if (upd && upd.available) {
        currentUpdate = upd
        updateInfo.set(upd as UpdaterInfo)
        updateAvailable.set(true)
        updateLog.set(`Update available: v${upd.version}`)
      } else {
        updateLog.set('Your app is up to date.')
      }
    } catch (error) {
      updateLog.set(`Error checking updates: ${error}`)
    }
  })

  async function updateNow() {
    if (!currentUpdate) {
      // nothing to install
      return
    }
    try {
      updateLog.set(`Downloading update v${currentUpdate.version}…`)
      await currentUpdate.downloadAndInstall()
      updateLog.set('Update installed. Restarting…')
      await relaunch()
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
      <p class="mt-2 text-sm whitespace-pre-wrap">
        {$updateInfo.body}
      </p>
      <div class="modal-action">
        <button class="btn btn-primary" on:click={updateNow}>
          Update Now
        </button>
        <button
          class="btn btn-secondary"
          on:click={() => updateAvailable.set(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<footer
  class="fixed inset-x-0 bottom-0 p-4 text-xs text-base-content/40 font-semibold"
>
  Current Version: {$currentVersion}
</footer>

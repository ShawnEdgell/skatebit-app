<script lang="ts">
  import { onMount } from 'svelte'
  import { check, Update } from '@tauri-apps/plugin-updater'
  import { relaunch } from '@tauri-apps/plugin-process'
  import { getVersion } from '@tauri-apps/api/app'
  import { writable } from 'svelte/store'

  export const ssr = false

  interface UpdaterInfo {
    version: string
    pub_date?: string
    notes: string
  }

  const updateAvailable = writable(false)
  const updateInfo = writable<UpdaterInfo>({
    version: '',
    pub_date: '',
    notes: '',
  })
  const updateLog = writable<string>('')

  const currentVersion = writable<string>('')

  let currentUpdate: Update | null = null

  onMount(async () => {
    try {
      currentVersion.set(await getVersion())

      updateLog.set('Checking for updates…')
      const upd = await check()
      updateLog.set('Update check completed.')

      if (upd?.available) {
        currentUpdate = upd
        updateInfo.set({
          version: upd.version,
          pub_date: (upd as any).pub_date ?? '',
          notes: String((upd as any).notes ?? ''),
        })
        updateAvailable.set(true)
        updateLog.set(`Update available: v${upd.version}`)
      } else {
        updateLog.set('Your app is up to date.')
      }
    } catch (e) {
      updateLog.set(`Error checking updates: ${e}`)
    }
  })

  async function updateNow() {
    if (!currentUpdate) return
    try {
      updateLog.set(`Downloading update v${currentUpdate.version}…`)
      await currentUpdate.downloadAndInstall()
      updateLog.set('Update installed. Restarting…')
      await relaunch()
    } catch (e) {
      updateLog.set(`Error updating: ${e}`)
    }
  }
</script>

{#if $updateAvailable}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-bold">Update Available!</h3>
      <p>
        A new update (v{$updateInfo.version}) is available!
      </p>
      <p class="mt-2 text-sm whitespace-pre-wrap">
        {$updateInfo.notes}
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
  class="text-base-content/40 fixed inset-x-0 bottom-0 p-4 text-xs font-semibold"
>
  Current Version: {$currentVersion}
</footer>

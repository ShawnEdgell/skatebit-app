<!-- src/lib/components/Updater.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { check, Update } from '@tauri-apps/plugin-updater'
  import { relaunch } from '@tauri-apps/plugin-process'
  import { getVersion } from '@tauri-apps/api/app'
  import { writable, derived } from 'svelte/store'

  interface UpdaterInfo {
    version: string
    pub_date?: string
    notes: string
  }

  // --- Stores ---
  const updateAvailable = writable(false)
  const updateInfo = writable<UpdaterInfo>({
    version: '',
    pub_date: '',
    notes: '',
  })
  const updateLog = writable<string>('')
  const currentVersion = writable<string>('')

  // nicely formatted date (e.g. "April 18, 2025")
  const formattedDate = derived(updateInfo, ($info) => {
    if (!$info.pub_date) return ''
    const d = new Date($info.pub_date)
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  })

  let currentUpdate: Update | null = null

  onMount(async () => {
    try {
      currentVersion.set(await getVersion())

      updateLog.set('Checking for updates…')
      const upd = await check()
      updateLog.set('Update check completed.')

      if (upd?.available) {
        currentUpdate = upd
        // plugin-updater will expose pub_date & notes
        updateInfo.set({
          version: upd.version,
          pub_date: (upd as any).pub_date,
          notes: (upd as any).notes,
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
      <h3 class="font-bold text-lg">Update Available!</h3>
      <p>
        A new update (v{$updateInfo.version}) is available!
        {#if $formattedDate}
          <br />Released on: {$formattedDate}
        {/if}
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
  class="fixed inset-x-0 bottom-0 p-4 text-xs text-base-content/40 font-semibold"
>
  Current Version: {$currentVersion}
</footer>

<script lang="ts">
  import { onMount } from 'svelte';
  import { check } from '@tauri-apps/plugin-updater';
  import { relaunch } from '@tauri-apps/plugin-process';
  import { writable } from 'svelte/store';

  interface UpdaterInfo {
    version: string;
    date?: string;
    body: string;
    [key: string]: any;
  }

  const updateAvailable = writable(false);
  const updateInfo = writable<UpdaterInfo>({ version: '', body: '' });
  const updateLog = writable<string>(''); 

  onMount(async () => {
    try {
      const update = await check();
      updateLog.set("Update check completed.");
      if (update?.available) {
        updateInfo.set(update as UpdaterInfo);
        updateAvailable.set(true);
        updateLog.set(`Update available: version ${(update as UpdaterInfo).version}`);
      } else {
        updateLog.set("No update available.");
      }
    } catch (error) {
      updateLog.set(`Error during update check: ${error}`);
    }
  });

  async function updateNow() {
    try {
      const update = await check();
      if (update?.available) {
        updateLog.set(`Downloading update version ${(update as UpdaterInfo).version}...`);
        await update.downloadAndInstall();
        updateLog.set("Update installed. Restarting...");
        await relaunch();
      }
    } catch (error) {
      updateLog.set(`Error updating: ${error}`);
    }
  }
</script>

{#if $updateAvailable}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Update Available!</h3>
      <p>
        A new update (v{$updateInfo.version}) is available!
        {#if $updateInfo.date}Released on: {$updateInfo.date}{/if}.
      </p>
      <p>Release notes: {$updateInfo.body}</p>
      <div class="modal-action">
        <button class="btn btn-primary" on:click={updateNow}>Update Now</button>
        <button class="btn btn-secondary" on:click={() => updateAvailable.set(false)}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

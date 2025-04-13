<script lang="ts">
  import { onMount } from 'svelte';
  import { check } from '@tauri-apps/plugin-updater';
  import { relaunch } from '@tauri-apps/plugin-process';
  import { writable } from 'svelte/store';

  // Define an interface for the update info (making date optional)
  interface UpdaterInfo {
    version: string;
    date?: string;
    body: string;
    // add additional fields if needed
  }

  const updateAvailable = writable(false);
  const updateInfo = writable<UpdaterInfo>({ version: '', body: '' });

  onMount(async () => {
    const update = await check();
    if (update?.available) {
      updateInfo.set(update as UpdaterInfo);
      updateAvailable.set(true);
    }
  });

  async function updateNow() {
    const update = await check();
    if (update?.available) {
      await update.downloadAndInstall();
      await relaunch();
    }
  }

  // Optional: a function to close the modal (if you want to allow dismissing it)
  function closeModal() {
    updateAvailable.set(false);
  }
</script>

{#if $updateAvailable}
  <!-- DaisyUI modal markup: -->
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Update Available!</h3>
      <p class="py-4">
        A new update (v{$updateInfo.version}) is available! {#if $updateInfo.date}Released on: {$updateInfo.date}. {/if}
        {#if $updateInfo.body}
          Release notes: {$updateInfo.body}
        {/if}
      </p>
      <div class="modal-action">
        <button class="btn btn-primary" on:click={updateNow}>
          Update Now
        </button>
        <button class="btn btn-ghost" on:click={closeModal}>
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

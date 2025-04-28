<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { ConfigMeta } from '$lib/firebase/configs'
  export let config: ConfigMeta

  const dispatch = createEventDispatcher()

  let displayName = config.fileName
  let description = config.description || ''

  function save() {
    dispatch('save', {
      ...config,
      fileName: displayName.trim(),
      description: description.trim(),
    })
  }
  function cancel() {
    dispatch('cancel')
  }
</script>

<div class="space-y-4">
  <div>
    <label class="block text-sm font-medium">Filename</label>
    <input class="input input-bordered w-full" bind:value={displayName} />
  </div>
  <div>
    <label class="block text-sm font-medium">Description</label>
    <textarea
      class="textarea textarea-bordered w-full"
      rows="4"
      bind:value={description}
    ></textarea>
  </div>
  <div class="flex justify-end gap-2">
    <button class="btn btn-secondary btn-sm" on:click={cancel}> Cancel </button>
    <button
      class="btn btn-primary btn-sm"
      on:click={save}
      disabled={!displayName.trim()}
    >
      Save
    </button>
  </div>
</div>

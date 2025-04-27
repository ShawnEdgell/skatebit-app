<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { User } from 'firebase/auth'
  import HubListItem from './HubListItem.svelte'
  import type { ConfigMeta } from '$lib/firebase/configs'
  import type { Category } from './CategorySelector.svelte'

  // Props
  export let configs: ConfigMeta[]
  export let selectedCategory: Category
  export let isLoading: boolean = true
  // Accept string | null from the parent page
  export let isDownloading: string | null = null
  export let isDeleting: string | null = null
  export let user: User | null
  export let explorerDirectory: string | null

  const dispatch = createEventDispatcher()

  // Generic function to forward events from list items
  function forwardEvent(event: CustomEvent) {
    // Log ALL events being forwarded for debugging
    // console.log(`[HubList] forwardEvent received event: type=${event.type}, detail=`, event.detail);

    // Specifically check if it's the one we care about
    // if (event.type === 'showDetails') {
    //     console.log('[HubList] Forwarding showDetails event...');
    // }
    dispatch(event.type, event.detail)
  }
</script>

<div class="min-h-0 flex-grow overflow-y-auto">
  {#if isLoading}
    <div class="flex h-full items-center justify-center pt-10">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if configs.length === 0}
    <div class="flex h-full flex-col items-center justify-center pt-10">
      <p class="text-base-content/60 py-4 text-center text-sm">
        No public configs found for {selectedCategory.name} yet. <br />
        Be the first to upload one!
      </p>
    </div>
  {:else}
    <ul class="space-y-2 p-1">
      {#each configs as config (config.fileName)}
        <HubListItem
          {config}
          categoryIcon={selectedCategory.Icon}
          isDownloading={isDownloading === config.fileName}
          isDeleting={isDeleting === config.fileName}
          {user}
          {explorerDirectory}
          on:download={forwardEvent}
          on:toggleLike={forwardEvent}
          on:delete={forwardEvent}
          on:showDetails={forwardEvent}
          on:edit={forwardEvent}
        />
      {/each}
    </ul>
  {/if}
</div>

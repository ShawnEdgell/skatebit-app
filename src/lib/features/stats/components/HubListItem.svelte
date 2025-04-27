<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { SvelteComponent } from 'svelte'
  import type { User } from 'firebase/auth'
  import { Timestamp } from 'firebase/firestore'

  import FormattedDate from './FormattedDate.svelte' // Adjust path if needed
  // Import Edit2 icon
  import { ThumbsUp, Trash2, Download, Info, Edit2 } from 'lucide-svelte'
  import type { ConfigMeta } from '$lib/firebase/configs'

  export let config: ConfigMeta
  export let categoryIcon: typeof SvelteComponent
  export let isDownloading: boolean = false
  export let isDeleting: boolean = false
  export let user: User | null
  export let explorerDirectory: string | null

  const dispatch = createEventDispatcher()

  $: hasLiked = user && config.likesBy?.includes(user.uid)
  $: isAuthor = user && config.author?.uid === user.uid
  $: installDisabled =
    isDownloading ||
    !explorerDirectory ||
    explorerDirectory.startsWith('/error') ||
    isDeleting
  $: likeDisabled = !user || isDownloading || isDeleting
  $: deleteDisabled = isDeleting || isDownloading
  // Disable edit button during other operations
  $: editDisabled = isDownloading || isDeleting

  function triggerDownload() {
    dispatch('download', config.fileName)
  }
  function triggerToggleLike() {
    dispatch('toggleLike', config.fileName)
  }
  function triggerDelete() {
    dispatch('delete', config.fileName)
  }
  function triggerShowDetails() {
    dispatch('showDetails', config)
  }
  // Function to dispatch the edit event
  function triggerEdit() {
    dispatch('edit', config)
  }
</script>

<li
  class="hover:bg-base-200 rounded-box flex items-center justify-between gap-4 p-2 transition-colors duration-150"
>
  <div class="flex-1 space-y-1 overflow-hidden">
    <div class="flex items-center gap-2">
      <svelte:component
        this={categoryIcon}
        class="text-primary h-5 w-5 flex-shrink-0"
      />
      <span
        class="truncate font-mono font-medium"
        title="{config.fileName}.xml"
      >
        {config.fileName}.xml
      </span>
    </div>
    <div class="text-base-content/70 truncate text-xs">
      by <strong>{config.author?.name || 'Anonymous'}</strong>
      {#if config.createdAt}
        <span>on <FormattedDate date={config.createdAt as Timestamp} /></span>
      {/if}
    </div>
    <div class="text-base-content/70 mt-1 text-xs">
      Downloads: {config.downloadCount || 0}
    </div>
  </div>

  <div class="flex flex-shrink-0 items-center gap-1">
    <button
      class="btn btn-ghost btn-xs px-2"
      title="Show details"
      on:click={triggerShowDetails}
      disabled={isDownloading || isDeleting}
    >
      <Info class="h-4 w-4" />
    </button>

    <button
      class="btn btn-ghost btn-xs gap-1 px-2"
      title={user ? (hasLiked ? 'Unlike' : 'Like') : 'Sign in to like'}
      on:click={triggerToggleLike}
      disabled={likeDisabled}
    >
      <ThumbsUp
        class={`h-4 w-4 transition-colors ${hasLiked ? 'text-primary fill-current' : 'text-base-content/50'}`}
      />
      <span class="text-base-content text-sm font-medium"
        >{config.likesBy?.length || 0}</span
      >
    </button>

    <button
      class="btn btn-ghost btn-primary btn-xs px-2"
      on:click={triggerDownload}
      disabled={installDisabled}
      title={!explorerDirectory || explorerDirectory.startsWith('/error')
        ? 'Set Skater XL directory first'
        : `Install ${config.fileName}.xml`}
    >
      {#if isDownloading}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <Download class="h-4 w-4" />
      {/if}
    </button>

    {#if isAuthor}
      <button
        class="btn btn-ghost btn-warning btn-xs px-2"
        title="Edit details"
        on:click={triggerEdit}
        disabled={editDisabled}
      >
        <Edit2 class="h-4 w-4" />
      </button>
    {/if}

    {#if isAuthor}
      <button
        class="btn btn-ghost btn-error btn-xs px-2"
        title="Delete your config"
        on:click={triggerDelete}
        disabled={deleteDisabled}
      >
        {#if isDeleting}
          <span class="loading loading-spinner loading-xs"></span>
        {:else}
          <Trash2 class="h-4 w-4" />
        {/if}
      </button>
    {/if}
  </div>
</li>

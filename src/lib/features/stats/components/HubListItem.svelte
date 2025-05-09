<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { SvelteComponent } from 'svelte'
  import type { User } from 'firebase/auth'
  import { Timestamp } from 'firebase/firestore'

  // Removed imports for profile card functionality
  // import UserProfileCard from '$lib/components/UserProfileCard.svelte';
  // import { getUserProfile, type UserProfile } from '$lib/firebase/users';

  // Other imports
  import FormattedDate from './FormattedDate.svelte' // Adjust path if needed
  import { ThumbsUp, Trash2, Download, Info, Edit2 } from 'lucide-svelte'
  import type { ConfigMeta } from '$lib/firebase/configs'

  export let config: ConfigMeta
  export let categoryIcon: typeof SvelteComponent
  export let isDownloading: boolean = false
  export let isDeleting: boolean = false
  export let user: User | null // Currently logged-in user
  export let explorerDirectory: string | null

  const dispatch = createEventDispatcher()

  // Removed state variables for popover
  // let authorProfile: UserProfile | null = null;
  // let isLoadingProfile: boolean = false;
  // let profileFetchAttempted: boolean = false;

  // --- Computed Properties ---
  $: hasLiked = !!(user && config.author && config.likesBy?.includes(user.uid))
  $: isAuthor = !!(user && config.author && user.uid === config.author.uid)
  $: installDisabled =
    isDownloading ||
    !explorerDirectory ||
    explorerDirectory.startsWith('/error') ||
    isDeleting
  $: likeDisabled = !user || isDownloading || isDeleting
  $: deleteDisabled = isDeleting || isDownloading
  $: editDisabled = isDownloading || isDeleting

  // --- Event Handlers ---
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
  function triggerEdit() {
    dispatch('edit', config)
  }

  // Removed fetchAuthorProfile and handleInteraction functions
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
    <div class="text-base-content/70 flex items-center gap-1 truncate text-xs">
      <span>by</span>
      <strong class="font-semibold">{config.author?.name || 'Anonymous'}</strong
      >
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
      class="btn btn-xs btn-ghost text-info hover:bg-info hover:text-info-content"
      title="Show details"
      on:click={triggerShowDetails}
      disabled={isDownloading || isDeleting}
    >
      <Info class="h-4 w-4" />
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
        class="btn btn-xs btn-ghost text-warning hover:bg-warning hover:text-warning-content"
        title="Edit details"
        on:click={triggerEdit}
        disabled={editDisabled}
      >
        <Edit2 class="h-4 w-4" />
      </button>
      <button
        class="btn btn-xs btn-ghost text-error hover:bg-error hover:text-error-content"
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

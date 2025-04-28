<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { SvelteComponent } from 'svelte'
  import type { User } from 'firebase/auth'
  import { Timestamp } from 'firebase/firestore'

  import UserProfileCard from '$lib/features/stats/components/UserProfileCard.svelte'
  import { getUserProfile, type UserProfile } from '$lib/firebase/users'

  import FormattedDate from './FormattedDate.svelte'
  import { ThumbsUp, Trash2, Download, Info, Edit2 } from 'lucide-svelte'
  import type { ConfigMeta } from '$lib/firebase/configs'

  export let config: ConfigMeta
  export let categoryIcon: typeof SvelteComponent
  export let isDownloading: boolean = false
  export let isDeleting: boolean = false
  export let user: User | null
  export let explorerDirectory: string | null

  const dispatch = createEventDispatcher()

  let authorProfile: UserProfile | null = null
  let isLoadingProfile: boolean = false
  let profileFetchAttempted: boolean = false

  function fetchAuthorProfileOnHover() {
    if (profileFetchAttempted || isLoadingProfile || !config.author?.uid) return
    profileFetchAttempted = true
    isLoadingProfile = true
    getUserProfile(config.author.uid)
      .then((profile) => (authorProfile = profile))
      .catch(() => (authorProfile = null))
      .finally(() => (isLoadingProfile = false))
  }

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
      <div class="dropdown dropdown-hover dropdown-top">
        <label
          tabindex="0"
          class="link link-hover font-semibold"
          on:mouseenter={fetchAuthorProfileOnHover}
          on:focus={fetchAuthorProfileOnHover}
        >
          {config.author?.name || 'Anonymous'}
        </label>
        <div
          tabindex="0"
          class="dropdown-content bg-base-100 mt-2 w-80 overflow-hidden rounded-lg shadow-lg"
        >
          {#if isLoadingProfile}
            <div class="flex flex-col items-center p-4 text-sm">
              <span class="loading loading-spinner loading-sm"></span>
              <span class="mt-2">Loading profile…</span>
            </div>
          {:else if authorProfile}
            <UserProfileCard profile={authorProfile} />
          {:else if profileFetchAttempted}
            <div class="text-base-content/60 p-4 text-center text-sm">
              Could not load profile.
            </div>
          {/if}
        </div>
      </div>
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
      on:click={triggerShowDetails}
      disabled={isDownloading || isDeleting}
      title="Show details"
    >
      <Info class="h-4 w-4" />
    </button>
    <button
      class="btn btn-ghost btn-xs gap-1 px-2"
      on:click={triggerToggleLike}
      disabled={likeDisabled}
      title={user ? (hasLiked ? 'Unlike' : 'Like') : 'Sign in to like'}
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
        on:click={triggerEdit}
        disabled={editDisabled}
        title="Edit details"
      >
        <Edit2 class="h-4 w-4" />
      </button>
      <button
        class="btn btn-ghost btn-error btn-xs px-2"
        on:click={triggerDelete}
        disabled={deleteDisabled}
        title="Delete your config"
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

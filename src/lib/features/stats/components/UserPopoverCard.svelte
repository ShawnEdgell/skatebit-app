<script lang="ts">
  import { onMount } from 'svelte'
  import type { User } from 'firebase/auth' // For author prop type if needed

  // Import profile fetching logic and types
  import { getUserProfile, type UserProfile } from '$lib/firebase/users' // Adjust path if needed

  // Import Lucide icons
  import { User as UserIcon, Youtube, Instagram, Link } from 'lucide-svelte' // Add other icons as needed

  // --- Props ---
  // Expect an author object with at least uid and name
  export let author: { uid: string; name: string | null } | undefined | null

  // --- State ---
  let authorProfile: UserProfile | null = null
  let isLoadingProfile: boolean = false
  let profileFetchAttempted: boolean = false

  // --- Computed ---
  $: authorName = author?.name || 'Anonymous'
  $: authorUid = author?.uid

  // --- Lifecycle ---
  onMount(() => {
    // Fetch profile immediately if UID exists when component mounts
    if (authorUid && !profileFetchAttempted) {
      fetchAuthorProfile()
    }
  })

  // --- Functions ---
  async function fetchAuthorProfile() {
    if (!authorUid) return // Guard against missing UID

    profileFetchAttempted = true
    isLoadingProfile = true
    authorProfile = null

    try {
      authorProfile = await getUserProfile(authorUid)
    } catch (error) {
      console.error(
        `[AuthorPopover] Error fetching profile for ${authorUid}:`,
        error,
      )
      authorProfile = null
    } finally {
      isLoadingProfile = false
    }
  }

  // --- Helper Functions for Display ---
  function ensureProtocol(url?: string): string | undefined {
    if (!url || !url.trim()) return undefined
    if (/^(https?:\/\/|mailto:)/i.test(url)) return url
    if (url.includes('#') && url.length > 2) return undefined
    return 'https://' + url
  }

  function formatDiscordDisplay(d?: string): string | undefined {
    if (!d?.trim()) return undefined
    return d.includes('discord.gg') || d.includes('discord.com/invite')
      ? 'Server Invite'
      : d.trim()
  }

  function getDiscordUrl(d?: string): string | undefined {
    if (!d?.trim()) return undefined
    return d.includes('discord.gg') || d.includes('discord.com/invite')
      ? ensureProtocol(d)
      : undefined
  }

  function formatEmailLink(e?: string | null): string | undefined {
    return e ? `mailto:${e}` : undefined
  }

  // --- Reactive Data Preparation for Display ---
  $: hasProfileContent =
    !!authorProfile?.bio ||
    !!authorProfile?.discord ||
    !!authorProfile?.tiktok ||
    !!authorProfile?.youtube ||
    !!authorProfile?.instagram

  $: socialLinks = authorProfile
    ? [
        {
          name: 'Discord',
          display: formatDiscordDisplay(authorProfile.discord),
          url: getDiscordUrl(authorProfile.discord),
          Icon: Link,
          color: 'badge-info',
        },
        {
          name: 'TikTok',
          display: 'TikTok',
          url: ensureProtocol(authorProfile.tiktok),
          Icon: Link,
          color: 'badge-accent',
        },
        {
          name: 'YouTube',
          display: 'YouTube',
          url: ensureProtocol(authorProfile.youtube),
          Icon: Youtube,
          color: 'badge-error',
        },
        {
          name: 'Instagram',
          display: 'Instagram',
          url: ensureProtocol(authorProfile.instagram),
          Icon: Instagram,
          color: 'badge-secondary',
        },
      ].filter((link) => link.display || link.url) // Filter if display OR url exists
    : []
</script>

{#if authorUid}
  <div class="dropdown dropdown-hover dropdown-top">
    <span
      tabindex="0"
      role="button"
      class="link link-hover cursor-pointer font-semibold"
      aria-haspopup="true"
      on:focus|once={fetchAuthorProfile}
      on:mouseenter|once={fetchAuthorProfile}
    >
      {authorName}
    </span>

    <div
      tabindex="0"
      role="tooltip"
      class="dropdown-content rounded-box bg-base-200 card z-50 w-72 p-0 shadow-xl md:w-80"
    >
      {#if isLoadingProfile}
        <div class="card-body items-center p-4 text-center">
          <span class="loading loading-sm loading-spinner"></span>
          <span class="text-xs">Loading profile...</span>
        </div>
      {:else if authorProfile}
        <div class="card-body p-4">
          <div class="mb-3 flex items-center gap-3">
            {#if authorProfile.photoURL}
              <div class="avatar flex-shrink-0">
                <div
                  class="ring-primary ring-offset-base-100 w-10 rounded-full ring ring-offset-1"
                >
                  <img
                    src={authorProfile.photoURL}
                    alt="{authorProfile.name || 'User'}'s Avatar"
                    referrerpolicy="no-referrer"
                  />
                </div>
              </div>
            {:else}
              <div class="avatar placeholder flex-shrink-0">
                <div
                  class="bg-neutral-focus text-neutral-content ring-primary ring-offset-base-100 flex w-10 items-center justify-center rounded-full ring ring-offset-1"
                >
                  <UserIcon class="h-5 w-5" />
                </div>
              </div>
            {/if}
            <div class="overflow-hidden">
              <p
                class="truncate text-sm font-bold"
                title={authorProfile.name || 'Anonymous User'}
              >
                {authorProfile.name || 'Anonymous User'}
              </p>
              <p class="text-xs opacity-60">
                {authorProfile.bio
                  ? 'User Bio'
                  : authorProfile.email
                    ? authorProfile.email
                    : 'No bio yet'}
              </p>
            </div>
          </div>
          {#if authorProfile.bio}
            <p class="prose prose-sm prose-p:my-1 mb-3 max-w-none text-sm">
              {authorProfile.bio}
            </p>
          {/if}
          {#if socialLinks.length > 0}
            <div
              class="card-actions border-base-300/50 flex-wrap justify-start gap-1 border-t pt-2"
            >
              {#each socialLinks as link}
                {#if link.url}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="badge {link.color} badge-outline gap-1 text-xs transition-all hover:brightness-110"
                    title="Visit {link.name}"
                  >
                    <svelte:component this={link.Icon} class="h-3 w-3" />
                    {link.display}
                  </a>
                {:else if link.display}
                  <span
                    class="badge {link.color} badge-outline gap-1 text-xs"
                    title="{link.name}: {link.display}"
                  >
                    <svelte:component this={link.Icon} class="h-3 w-3" />
                    {link.display}
                  </span>
                {/if}
              {/each}
            </div>
          {/if}
          {#if !hasProfileContent}
            <p class="text-base-content/50 mt-2 text-xs italic">
              This user hasn't added profile details yet.
            </p>
          {/if}
        </div>
      {:else if profileFetchAttempted}
        <div class="card-body items-center p-4 text-center">
          <p class="text-base-content/70 text-xs italic">Profile not found.</p>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <strong class="font-semibold">{authorName}</strong>
{/if}

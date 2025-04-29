<script lang="ts">
  import { onMount } from 'svelte'
  import { writable, get } from 'svelte/store'
  import type { Writable } from 'svelte/store'
  import { goto } from '$app/navigation'

  import { user as userStore } from '$lib/stores/authStore'
  import type { UserProfile } from '$lib/firebase/users'
  import { getUserProfile, updateUserProfile } from '$lib/firebase/users'

  import { handleError, handleSuccess } from '$lib/utils/errorHandler'
  import { User, Mail, Save } from 'lucide-svelte' // Removed Link as it wasn't used

  let isLoading = writable(true)
  let profileData: Writable<Partial<UserProfile>> = writable({})
  let isSaving = writable(false)

  $: currentUser = $userStore
  $: name = currentUser?.displayName ?? 'N/A'
  $: email = currentUser?.email ?? 'N/A'
  $: photoURL = currentUser?.photoURL

  onMount(async () => {
    // Redirect immediately if no user on mount
    const user = get(userStore) // Get current value directly
    if (!user) {
      console.log('Dashboard: No user found on mount, redirecting...')
      goto('/')
      return
    }

    isLoading.set(true)
    try {
      const fetchedProfile = await getUserProfile(user.uid)
      if (fetchedProfile) {
        profileData.set({
          bio: fetchedProfile.bio ?? '',
          discord: fetchedProfile.discord ?? '',
          tiktok: fetchedProfile.tiktok ?? '',
          youtube: fetchedProfile.youtube ?? '',
          instagram: fetchedProfile.instagram ?? '',
        })
      } else {
        profileData.set({
          bio: '',
          discord: '',
          tiktok: '',
          youtube: '',
          instagram: '',
        })
      }
    } catch (error) {
      handleError(error, 'Loading user profile')
      profileData.set({
        bio: '',
        discord: '',
        tiktok: '',
        youtube: '',
        instagram: '',
      })
    } finally {
      isLoading.set(false)
    }
  })

  async function saveProfile() {
    const user = get(userStore) // Get current value
    if (!user) {
      handleError(new Error('Not signed in.'), 'Save Profile')
      return
    }
    isSaving.set(true)
    try {
      const dataToSave = get(profileData)
      await updateUserProfile(user.uid, dataToSave)
      handleSuccess('Profile updated successfully!', 'Save Profile')
    } catch (error) {
      handleError(error, 'Saving user profile')
    } finally {
      isSaving.set(false)
    }
  }

  function isValidUrl(urlString?: string): boolean {
    if (!urlString || urlString.trim() === '') return true
    // Basic check for common protocols or just allow anything starting with http/https
    // Or allow specific platform patterns if needed. For simplicity, just check protocol.
    if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
      try {
        new URL(urlString)
        return true
      } catch (_) {
        return false
      }
    }
    // Allow non-URL strings for things like Discord username
    if (urlString.includes('#') && urlString.length > 2) return true // Basic Discord name check
    return false // Default to false if not a URL or potential Discord name
  }

  // Re-evaluate validation logic based on updated isValidUrl
  $: isDiscordValid = true // Allow usernames or URLs for Discord
  $: isTikTokValid = isValidUrl($profileData.tiktok)
  $: isYouTubeValid = isValidUrl($profileData.youtube)
  $: isInstagramValid = isValidUrl($profileData.instagram)
  $: isFormValid =
    isDiscordValid && isTikTokValid && isYouTubeValid && isInstagramValid
</script>

<div class="flex h-full w-full flex-col overflow-hidden px-4">
  {#if $isLoading}
    <div class="flex flex-grow items-center justify-center">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if !currentUser}
    <p
      class="text-error flex flex-grow items-center justify-center text-center"
    >
      You must be logged in to view this page.
    </p>
  {:else}
    <div class="flex-grow overflow-y-auto pb-4">
      <div class="bg-base-100 rounded-box p-4 shadow-xl">
        <div class="mb-6 flex items-center gap-4">
          {#if photoURL}
            <div class="avatar">
              <div
                class="ring-primary ring-offset-base-100 w-20 rounded-full ring ring-offset-2"
              >
                <img
                  src={photoURL}
                  alt="User Avatar"
                  referrerpolicy="no-referrer"
                />
              </div>
            </div>
          {:else}
            <div class="avatar placeholder">
              <div
                class="bg-neutral-focus text-neutral-content ring-primary ring-offset-base-100 w-20 rounded-full ring ring-offset-2"
              >
                <User class="h-10 w-10" />
              </div>
            </div>
          {/if}
          <div class="text-center sm:text-left">
            <h2 class="text-2xl font-semibold">{name}</h2>
            <p
              class="text-base-content/70 flex items-center justify-center gap-1 text-sm sm:justify-start"
            >
              <Mail class="h-4 w-4" />
              {email}
            </p>
          </div>
        </div>

        <form on:submit|preventDefault={saveProfile} class="space-y-4">
          <div>
            <label for="bio" class="label pb-1">
              <span class="label-text font-medium">Bio</span>
            </label>
            <textarea
              id="bio"
              class="textarea textarea-bordered w-full"
              rows="3"
              placeholder="Tell us a little about yourself..."
              bind:value={$profileData.bio}
              maxlength="200"
              aria-describedby="bio-helper"
            ></textarea>

            <div class="label pt-1">
              <span class="label-text-alt"></span>
              <span
                id="bio-helper"
                class="label-text-alt text-base-content/60 text-xs"
              >
                Max 200 characters
              </span>
            </div>
          </div>

          <h3 class="pt-4 text-lg font-semibold">Social Links</h3>

          <div class="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
            <div class="form-control">
              <label for="discord" class="label pb-1">
                <span class="label-text text-sm"
                  >Discord Username / Server Invite</span
                >
              </label>
              <input
                type="text"
                id="discord"
                placeholder="e.g. username#1234"
                class="input input-sm input-bordered w-full"
                bind:value={$profileData.discord}
              />
              {#if !isDiscordValid}<span class="text-error mt-1 text-xs"
                  >Invalid format.</span
                >{/if}
            </div>

            <div class="form-control">
              <label for="tiktok" class="label pb-1">
                <span class="label-text text-sm">TikTok Profile URL</span>
              </label>
              <input
                type="url"
                id="tiktok"
                placeholder="https://tiktok.com/@..."
                class="input input-sm input-bordered w-full"
                bind:value={$profileData.tiktok}
              />
              {#if !isTikTokValid}<span class="text-error mt-1 text-xs"
                  >Please enter a valid URL.</span
                >{/if}
            </div>

            <div class="form-control">
              <label for="youtube" class="label pb-1">
                <span class="label-text text-sm">YouTube Channel URL</span>
              </label>
              <input
                type="url"
                id="youtube"
                placeholder="https://youtube.com/..."
                class="input input-sm input-bordered w-full"
                bind:value={$profileData.youtube}
              />
              {#if !isYouTubeValid}<span class="text-error mt-1 text-xs"
                  >Please enter a valid URL.</span
                >{/if}
            </div>

            <div class="form-control">
              <label for="instagram" class="label pb-1">
                <span class="label-text text-sm">Instagram Profile URL</span>
              </label>
              <input
                type="url"
                id="instagram"
                placeholder="https://instagram.com/..."
                class="input input-sm input-bordered w-full"
                bind:value={$profileData.instagram}
              />
              {#if !isInstagramValid}<span class="text-error mt-1 text-xs"
                  >Please enter a valid URL.</span
                >{/if}
            </div>
          </div>

          <div class="pt-6 text-right">
            <button
              type="submit"
              class="btn btn-primary"
              disabled={$isSaving || !isFormValid}
            >
              {#if $isSaving}
                <span class="loading loading-spinner loading-xs mr-2"
                ></span>Saving...
              {:else}
                <Save class="mr-2 h-4 w-4" /> Save Profile
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

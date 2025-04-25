<script lang="ts">
  import { dev, browser } from '$app/environment'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { toastStore } from '$lib/stores/uiStore'
  import { handleError } from '$lib/utils/errorHandler'
  import { RefreshCw } from 'lucide-svelte'

  // IMPORTANT: Ensure this path matches the location of your +server.ts file
  // Example: If file is src/routes/api/update-cache/+server.ts, use '/api/update-cache'
  const UPDATE_CACHE_ENDPOINT = '/cache/server/'

  let isLoading = $state(false)

  onMount(() => {
    if (!dev && browser) {
      goto('/', { replaceState: true })
    }
  })

  async function triggerUpdate() {
    if (isLoading) return
    isLoading = true
    toastStore.addToast('Starting manual cache update...', 'alert-info', 3000)

    try {
      const response = await fetch(UPDATE_CACHE_ENDPOINT)

      if (!response.ok) {
        let errorMsg = `Request failed with status ${response.status}`
        try {
          const errorData = await response.json()
          errorMsg = errorData.error || errorMsg
        } catch (e) {
          // Ignore
        }
        throw new Error(errorMsg)
      }

      toastStore.addToast('Cache update successful!', 'alert-success', 5000)
    } catch (error: any) {
      handleError(error, 'Manual Cache Update')
      toastStore.addToast(
        `Cache update failed: ${error.message || 'Unknown error'}`,
        'alert-error',
      )
    } finally {
      isLoading = false
    }
  }
</script>

{#if dev}
  <div class="flex h-full w-full items-center justify-center">
    <button
      class="btn btn-primary"
      onclick={triggerUpdate}
      disabled={isLoading}
    >
      {#if isLoading}
        <span class="loading loading-spinner loading-xs"></span>
        Updating Cache...
      {:else}
        <RefreshCw class="mr-2 h-4 w-4" />
        Update Mod Cache Manually
      {/if}
    </button>
  </div>
{:else}
  <div class="flex h-full w-full items-center justify-center">
    <p>Loading...</p>
  </div>
{/if}

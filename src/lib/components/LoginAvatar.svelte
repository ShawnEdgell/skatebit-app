<script lang="ts">
  import { user as userStore } from '$lib/stores/authStore'
  import { auth } from '$lib/firebase/firebase'
  import { signOut } from 'firebase/auth'
  import { handleError } from '$lib/utils/errorHandler'
  import { UserCircle } from 'lucide-svelte' // Use the Lucide User icon
  import LoginButtonGoogle from '$lib/components/LoginButtonGoogle.svelte'

  async function logout() {
    try {
      await signOut(auth)
    } catch (e: any) {
      handleError(e, 'Logout')
    }
  }
</script>

<div class="dropdown dropdown-end px-2">
  <label tabindex="0" class="btn btn-ghost btn-circle avatar">
    <div
      class="ring-secondary ring-offset-base-100 flex w-10 items-center justify-center rounded-full ring-offset-2 hover:ring {!$userStore ||
      !$userStore.photoURL
        ? 'bg-base-100 text-base-content'
        : ''}"
    >
      {#if $userStore && $userStore.photoURL}
        <img
          src={$userStore.photoURL}
          alt={$userStore.displayName || 'User Avatar'}
          referrerpolicy="no-referrer"
          class="h-full w-full rounded-full object-cover"
        />
      {:else}
        <UserCircle class="h-full w-full" />
      {/if}
    </div>
  </label>
  <ul
    tabindex="0"
    class="menu dropdown-content bg-base-200 rounded-box top-12 z-[10] mt-6 w-52 p-2 shadow-md"
  >
    {#if $userStore}
      {#if $userStore.displayName}
        <li class="menu-title px-4 py-2 text-sm">
          <span>Signed in as {$userStore.displayName}</span>
        </li>
      {/if}
      <li>
        <a href="/dashboard" class="w-full text-left">Dashboard</a>
      </li>
      <li>
        <button on:click={logout} class="w-full text-left"> Logout </button>
      </li>
    {:else}
      <li class="p-2"><LoginButtonGoogle /></li>
    {/if}
  </ul>
</div>

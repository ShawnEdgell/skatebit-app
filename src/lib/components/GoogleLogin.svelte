<!-- src/lib/components/GoogleLogin.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { auth, googleProvider } from '$lib/firebase/firebase'
  import {
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    type User,
  } from 'firebase/auth'

  let user: User | null = null
  let error: string | null = null

  onMount(() => {
    // subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      (u) => {
        user = u
        error = null
      },
      (e) => {
        error = e.message
      },
    )
    return unsubscribe
  })

  async function login() {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e: any) {
      error = e.message
    }
  }

  async function logout() {
    try {
      await signOut(auth)
    } catch (e: any) {
      error = e.message
    }
  }
</script>

{#if user}
  <div class="flex justify-between">
    <div class="flex items-center gap-2">
      <img src={user.photoURL} alt="avatar" class="h-6 w-6 rounded-full" />
      <p class="text-xs">Hello, {user.displayName}!</p>
    </div>
    <button on:click={logout} class="btn btn-error btn-xs"> Logout </button>
  </div>
{:else}
  <button on:click={login} class="btn btn-sm btn-primary">
    Sign in with Google
  </button>
{/if}

{#if error}
  <p class="text-error mt-1">{error}</p>
{/if}

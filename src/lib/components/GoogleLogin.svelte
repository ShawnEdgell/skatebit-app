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

<div class="flex h-full flex-col items-center justify-center space-y-4">
  {#if user}
    <img src={user.photoURL} alt="avatar" class="h-12 w-12 rounded-full" />
    <p>Hello, {user.displayName}</p>
    <button on:click={logout} class="btn btn-error"> Logout </button>
  {:else}
    <button on:click={login} class="btn btn-primary">
      Sign in with Google
    </button>
  {/if}

  {#if error}
    <p class="text-error mt-1">{error}</p>
  {/if}
</div>

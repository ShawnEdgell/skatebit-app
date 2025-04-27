<script lang="ts">
  import { auth, googleProvider } from '$lib/firebase/firebase'
  import { signInWithPopup } from 'firebase/auth'
  import { handleError } from '$lib/utils/errorHandler'

  async function login() {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e: any) {
      if (
        e.code === 'auth/popup-closed-by-user' ||
        e.code === 'auth/cancelled-popup-request'
      ) {
        console.log('Google Sign-In cancelled by user.')
      } else {
        handleError(e, 'Google Sign-In')
      }
    }
  }
</script>

<button on:click={login} class="btn btn-sm btn-primary w-full">
  Sign in with Google
</button>

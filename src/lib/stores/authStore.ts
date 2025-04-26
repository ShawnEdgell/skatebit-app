import { writable } from 'svelte/store'
import type { User } from 'firebase/auth'
import { auth } from '$lib/firebase/firebase' // Path to your firebase setup
import { onAuthStateChanged } from 'firebase/auth'

// Writable store, initialized with the current user (or null)
export const user = writable<User | null>(null) // Start null to avoid SSR issues maybe? Or use auth.currentUser

// Loading state for auth initialization
export const authLoading = writable<boolean>(true)

// Listen to Firebase auth state changes and update the store
const unsubscribe = onAuthStateChanged(
  auth,
  (u) => {
    user.set(u)
    authLoading.set(false) // Auth state initialized
  },
  (error) => {
    console.error('Auth state error:', error)
    user.set(null)
    authLoading.set(false) // Still finished loading, just resulted in no user
  },
)

// Optional: Export unsubscribe if you need to manually stop listening,
// usually not needed if the store lives for the app lifetime.
// export { unsubscribe };

// Helper function to check if user is logged in (can be used in non-Svelte files)
export function isUserLoggedIn(): boolean {
  let loggedIn = false
  const unsubscribeCheck = user.subscribe((u) => {
    loggedIn = !!u
  })
  unsubscribeCheck() // Immediately unsubscribe after getting the value
  return loggedIn
}

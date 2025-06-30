import { writable } from 'svelte/store'

export const user = writable<any | null>(null)
export const authLoading = writable<boolean>(false)

export function isUserLoggedIn(): boolean {
  let loggedIn = false
  const unsubscribeCheck = user.subscribe((u) => {
    loggedIn = !!u
  })
  unsubscribeCheck()
  return loggedIn
}

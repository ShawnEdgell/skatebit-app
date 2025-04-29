import { Store } from 'tauri-plugin-store-api'

let store: Store | null = null

async function ensureStore() {
  if (store) return store
  // Only attempt to create the store if running in Tauri
  if ('__TAURI_IPC__' in window) {
    store = new Store('.skatebit.dat')
    return store
  } else {
    console.warn('[tauriStore] Not running in Tauri — skipping store init.')
    return null
  }
}

export async function getStoreValue<T = unknown>(
  key: string,
): Promise<T | null> {
  const s = await ensureStore()
  if (!s) return null
  try {
    const value = await s.get(key)
    return (value as T) ?? null
  } catch (err) {
    console.error(`[tauriStore] Failed to get "${key}":`, err)
    return null
  }
}

export async function setStoreValue<T = unknown>(
  key: string,
  value: T,
): Promise<void> {
  const s = await ensureStore()
  if (!s) return
  try {
    await s.set(key, value)
    await s.save()
  } catch (err) {
    console.error(`[tauriStore] Failed to set "${key}":`, err)
  }
}

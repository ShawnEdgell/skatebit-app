// src/routes/modio/+page.server.ts
import type { Mod } from '$lib/types/modioTypes'
import { db } from '$lib/firebase/firebase'
import { doc, getDoc } from 'firebase/firestore'

/**
 * Loads the first page of cached mods from Firestore.
 */
export const load = async (): Promise<{ mapMods: Mod[] }> => {
  try {
    const docRef = doc(db, 'mods_v2', 'page_1')
    const snapshot = await getDoc(docRef)
    let mapMods: Mod[] = []
    if (snapshot.exists()) {
      const data = snapshot.data()
      if (data.mods) {
        mapMods = data.mods
      }
    }
    return { mapMods }
  } catch (error) {
    console.error('Error fetching cached mods:', error)
    return { mapMods: [] }
  }
}

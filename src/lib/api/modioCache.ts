import { db } from '$lib/firebase/firebase'
import { doc, setDoc } from 'firebase/firestore'
import { fetchMapMods } from './modioFetch'
import { API_PAGE_SIZE } from './modioConstants'
import { MODIO_API_KEY } from './modioConfig'

const GAME_ID = '629'

export async function cacheAllMapModsToFirestore() {
  let allMods = []
  let offset = 0
  let page = 1

  while (true) {
    let mods
    try {
      mods = await fetchMapMods(MODIO_API_KEY, GAME_ID, API_PAGE_SIZE, offset)
    } catch (error) {
      console.error('Error fetching mods at offset', offset, error)
      break
    }

    if (!mods || mods.length === 0) {
      console.log('No mods returned, stopping.')
      break
    }

    console.log(`Fetched ${mods.length} mods (offset: ${offset})`)

    try {
      await setDoc(doc(db, 'mods', `page_${page}`), {
        mods,
        lastUpdated: Date.now(),
      })
    } catch (error) {
      console.error('Error writing page', page, error)
      break
    }

    allMods.push(...mods)
    if (mods.length < API_PAGE_SIZE) break

    offset += API_PAGE_SIZE
    page += 1
  }

  console.log(`✅ Cached ${allMods.length} mods across ${page} pages.`)
}

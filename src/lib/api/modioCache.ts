// src/lib/api/modioCache.ts

// Import types and functions from Firebase Admin SDK
import { type Firestore, FieldValue } from 'firebase-admin/firestore'
// Import the refactored fetch function and constants
import { fetchMapMods } from './modioFetch'
import { API_PAGE_SIZE } from './modioConstants'

const GAME_ID = '629' // Your specific game ID
const FIRESTORE_COLLECTION = 'mods' // Name of your Firestore collection

/**
 * Fetches all map mods from mod.io page by page and caches them
 * into Firestore documents (e.g., mods/page_1, mods/page_2).
 * Uses the Firebase Admin SDK.
 *
 * @param db - Initialized Firestore Admin instance.
 * @param apiKey - Your mod.io API Key.
 * @param modioDomain - The mod.io API domain (e.g., 'api.mod.io').
 */
export async function cacheAllMapModsToFirestore(
  db: Firestore,
  apiKey: string,
  modioDomain: string,
) {
  let allModsCount = 0
  let offset = 0
  let page = 1
  const startTime = Date.now()

  console.log(
    `Starting mod.io cache process for game ${GAME_ID} into Firestore collection '${FIRESTORE_COLLECTION}'...`,
  )

  try {
    while (true) {
      console.log(`Workspaceing page ${page} (offset: ${offset})...`)
      let mods
      try {
        // Fetch a page of mods using the refactored function
        mods = await fetchMapMods(
          apiKey,
          modioDomain,
          GAME_ID,
          API_PAGE_SIZE,
          offset,
        )
      } catch (fetchError) {
        // Log fetch error and stop the process
        console.error(
          `Failed to fetch mods at offset ${offset}. Stopping cache process. Error:`,
          fetchError,
        )
        throw new Error(`Cache failed during mod fetch at page ${page}.`) // Propagate error
      }

      // Check if the fetch returned mods
      if (!mods || mods.length === 0) {
        console.log(
          `No more mods returned at offset ${offset}. Finished fetching.`,
        )
        break // Exit the loop if no mods are returned
      }

      console.log(
        `Workspaceed ${mods.length} mods for page ${page}. Writing to Firestore...`,
      )

      try {
        // Get a reference to the Firestore document for the current page
        const docRef = db.collection(FIRESTORE_COLLECTION).doc(`page_${page}`)
        // Set the document content
        await docRef.set({
          mods: mods, // Array of mod objects for this page
          pageNumber: page,
          itemsPerPage: API_PAGE_SIZE,
          // Use Firestore server timestamp for accurate update time
          lastUpdated: FieldValue.serverTimestamp(),
        })
        console.log(
          `Successfully wrote page ${page} (${mods.length} mods) to Firestore.`,
        )
      } catch (writeError) {
        // Log Firestore write error and stop the process
        console.error(
          `Failed to write page ${page} to Firestore. Stopping cache process. Error:`,
          writeError,
        )
        throw new Error(`Cache failed during Firestore write for page ${page}.`) // Propagate error
      }

      allModsCount += mods.length

      // If the number of mods returned is less than the page size,
      // assume it's the last page
      if (mods.length < API_PAGE_SIZE) {
        console.log(
          `Workspaceed less than API_PAGE_SIZE (${mods.length}), assuming end of results.`,
        )
        break // Exit the loop
      }

      // Increment offset and page number for the next iteration
      offset += API_PAGE_SIZE
      page += 1

      // Optional: Add a small delay between page fetches to avoid rate limiting
      // await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
    }

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2) // Duration in seconds

    console.log(
      `✅ Successfully cached ${allModsCount} mods across ${page - 1} pages in ${duration} seconds.`,
    )
  } catch (error) {
    // Catch errors propagated from fetch/write operations
    console.error('⛔ Cache process failed overall:', error)
    // Re-throw the error so the calling script knows it failed
    throw error
  }
}

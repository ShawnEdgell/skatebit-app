// src/lib/api/modioCache.ts

import { type Firestore, FieldValue } from 'firebase-admin/firestore'
import { fetchMapMods } from './modioFetch' // Ensure this path is correct
import { API_PAGE_SIZE } from './modioConstants' // Ensure this path is correct

const GAME_ID = '629' // Your specific game ID
const TARGET_COLLECTION = 'mods_v2' // Writing to the new collection

/**
 * Fetches map mods from mod.io page by page and caches them
 * as individual documents (using mod ID as document ID) into the
 * specified Firestore collection (TARGET_COLLECTION).
 * Uses the Firebase Admin SDK and writes documents INDIVIDUALLY.
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
  let totalModsWritten = 0
  let offset = 0
  let page = 1
  const startTime = Date.now()

  console.log(
    `Starting mod.io cache process for game ${GAME_ID} into Firestore collection '${TARGET_COLLECTION}'...`,
  )
  console.log(
    `Using API page size: ${API_PAGE_SIZE}. Writing mods individually.`,
  )

  try {
    while (true) {
      console.log(`Workspaceing page ${page} (offset: ${offset})...`)
      let mods
      try {
        mods = await fetchMapMods(
          apiKey,
          modioDomain,
          GAME_ID,
          API_PAGE_SIZE,
          offset,
        )
      } catch (fetchError) {
        console.error(
          `Failed to fetch mods at offset ${offset}. Stopping cache process. Error:`,
          fetchError,
        )
        throw new Error(`Cache failed during mod fetch at page ${page}.`)
      }

      if (!mods || mods.length === 0) {
        console.log(
          `No more mods returned at offset ${offset}. Finished fetching.`,
        )
        break
      }

      console.log(
        `Workspaceed ${mods.length} mods for page ${page}. Writing individually to '${TARGET_COLLECTION}'...`,
      )
      let modsWrittenThisPage = 0

      // Loop through mods and write each one individually
      for (const mod of mods) {
        if (mod.id) {
          const modDocRef = db.collection(TARGET_COLLECTION).doc(String(mod.id))
          try {
            // Await each individual set operation
            // Using set with merge: true might be slightly safer if you only want to update fields,
            // but plain set ensures the document matches the latest fetched data exactly.
            await modDocRef.set({
              ...mod,
              _cachedAt: FieldValue.serverTimestamp(),
            })
            modsWrittenThisPage++
          } catch (writeError) {
            // Log error for the specific mod write and stop the process
            console.error(
              `Failed to write mod ID ${mod.id} to Firestore. Stopping cache process. Error:`,
              writeError,
            )
            if ((writeError as any).code) {
              console.error(`Error Code: ${(writeError as any).code}`)
            }
            throw new Error(
              `Cache failed during Firestore individual write for mod ${mod.id} on page ${page}.`,
            )
          }
          // Optional: Add a tiny delay between individual writes if throttling is suspected
          // await new Promise(resolve => setTimeout(resolve, 20)); // 20ms delay
        } else {
          console.warn(
            'Skipping mod write due to missing ID:',
            mod?.name_id || 'N/A',
          )
        }
      } // End of for...of loop

      console.log(
        `Finished processing page ${page}, wrote/updated ${modsWrittenThisPage} mods individually.`,
      )
      totalModsWritten += modsWrittenThisPage

      if (mods.length < API_PAGE_SIZE) {
        console.log(
          `Workspaceed less than API_PAGE_SIZE (${mods.length}), assuming end of results.`,
        )
        break
      }

      offset += API_PAGE_SIZE
      page += 1

      // Optional: Bigger delay between pages if needed
      // await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
    } // End of while loop

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    console.log(
      `✅ Successfully wrote/updated ${totalModsWritten} mods individually to collection '${TARGET_COLLECTION}' across ${page - 1} fetched pages in ${duration} seconds.`,
    )
  } catch (error) {
    console.error(`⛔ Cache process failed overall:`, error)
    throw error // Propagate error
  }
}

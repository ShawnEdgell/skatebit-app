// src/lib/api/modioCache.ts

import { type Firestore, FieldValue } from 'firebase-admin/firestore'
import { fetchMapMods } from './modioFetch'
import { API_PAGE_SIZE } from './modioConstants'

const GAME_ID = '629' // Your specific game ID
// *** DEFINE THE NEW TARGET COLLECTION ***
const TARGET_COLLECTION = 'mods_v2'

/**
 * Fetches all map mods from mod.io page by page and caches them
 * as individual documents (using mod ID as document ID) into the
 * specified Firestore collection (TARGET_COLLECTION).
 * Uses the Firebase Admin SDK and Batched Writes.
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
        `Workspaceed ${mods.length} mods for page ${page}. Preparing batch write to '${TARGET_COLLECTION}'...`,
      )

      // Use Firestore Batched Writes for efficiency
      const batch = db.batch()
      let modsInBatch = 0

      for (const mod of mods) {
        // Ensure the mod has an ID from mod.io to use as the document ID
        if (mod.id) {
          // Create a DocumentReference using the mod ID as the Firestore document ID
          // Writes to the new TARGET_COLLECTION
          const modDocRef = db.collection(TARGET_COLLECTION).doc(String(mod.id))
          // Add a 'set' operation to the batch. This overwrites existing docs with the same ID.
          // We add the full mod object and a timestamp indicating when it was cached.
          batch.set(modDocRef, {
            ...mod,
            _cachedAt: FieldValue.serverTimestamp(),
          })
          modsInBatch++
        } else {
          // Log a warning if a mod is missing an ID
          console.warn(
            'Skipping mod write due to missing ID:',
            mod?.name_id || 'N/A',
          )
        }
      }

      try {
        // Commit the batch if it contains operations
        if (modsInBatch > 0) {
          await batch.commit()
          console.log(
            `Successfully committed batch of ${modsInBatch} mods for page ${page} to Firestore collection '${TARGET_COLLECTION}'.`,
          )
          totalModsWritten += modsInBatch
        } else {
          console.log(`No mods with valid IDs found on page ${page} to write.`)
        }
      } catch (batchWriteError) {
        // Log Firestore batch write error and stop the process
        console.error(
          `Failed to commit batch write for page ${page} to collection '${TARGET_COLLECTION}'. Stopping cache process. Error:`,
          batchWriteError,
        )
        // Attempt to provide more specific details if available from the error object
        if ((batchWriteError as any).code) {
          console.error(`Error Code: ${(batchWriteError as any).code}`)
        }
        throw new Error(
          `Cache failed during Firestore batch write for page ${page}.`,
        )
      }

      // Break the loop if the last page fetched was not full
      if (mods.length < API_PAGE_SIZE) {
        console.log(
          `Workspaceed less than API_PAGE_SIZE (${mods.length}), assuming end of results.`,
        )
        break
      }

      // Increment offset and page number for the next iteration
      offset += API_PAGE_SIZE
      page += 1

      // Optional: Add a small delay to avoid hitting rate limits aggressively
      // await new Promise(resolve => setTimeout(resolve, 200));
    }

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2) // Duration in seconds

    console.log(
      `✅ Successfully wrote/updated ${totalModsWritten} mods individually to collection '${TARGET_COLLECTION}' across ${page - 1} fetched pages in ${duration} seconds.`,
    )
  } catch (error) {
    console.error(`⛔ Cache process failed overall:`, error)
    throw error // Re-throw the error so the calling script knows it failed
  }
}

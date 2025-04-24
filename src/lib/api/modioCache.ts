// src/lib/api/modioCache.ts

import { type Firestore, FieldValue } from 'firebase-admin/firestore'
import { fetchMapMods } from './modioFetch' // Ensure this path is correct
import { API_PAGE_SIZE } from './modioConstants' // Ensure this path is correct

const GAME_ID = '629' // Your specific game ID
const TARGET_COLLECTION = 'mods_v2' // Writing to the new collection
const MAX_BATCH_SIZE = 50 // Commit batch every 50 writes

/**
 * Fetches all map mods from mod.io page by page and caches them
 * as individual documents (using mod ID as document ID) into the
 * specified Firestore collection (TARGET_COLLECTION).
 * Uses the Firebase Admin SDK and commits writes in smaller batches.
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
    `Using API page size: ${API_PAGE_SIZE}, Firestore batch commit size: ${MAX_BATCH_SIZE}`,
  )

  try {
    // Loop indefinitely to fetch pages until no more mods are returned
    while (true) {
      console.log(`Workspaceing page ${page} (offset: ${offset})...`)
      let mods
      try {
        // Fetch a page of mods from mod.io API
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
        // Propagate the error to stop the entire process
        throw new Error(`Cache failed during mod fetch at page ${page}.`)
      }

      // If no mods are returned, we've reached the end
      if (!mods || mods.length === 0) {
        console.log(
          `No more mods returned at offset ${offset}. Finished fetching.`,
        )
        break // Exit the while loop
      }

      console.log(
        `Workspaceed ${mods.length} mods for page ${page}. Preparing batch writes to '${TARGET_COLLECTION}'...`,
      )

      // Initialize variables for batching within this page
      let batch = db.batch()
      let modsInCurrentBatch = 0
      let totalModsWrittenThisPage = 0

      // Inner try block specifically for handling batch commits for the current page
      try {
        // Iterate through the mods fetched for the current page
        for (const mod of mods) {
          // Ensure the mod has an ID from mod.io to use as the document ID
          if (mod.id) {
            // Create a DocumentReference using the mod ID as the Firestore document ID
            // Writes to the new TARGET_COLLECTION
            const modDocRef = db
              .collection(TARGET_COLLECTION)
              .doc(String(mod.id))
            // Add a 'set' operation to the current batch.
            // This overwrites existing docs with the same ID (effectively an upsert).
            // Include all mod data and add a timestamp for when it was cached.
            batch.set(modDocRef, {
              ...mod,
              _cachedAt: FieldValue.serverTimestamp(),
            })
            modsInCurrentBatch++
            totalModsWrittenThisPage++

            // Commit the current batch if it reaches the defined max size
            if (modsInCurrentBatch === MAX_BATCH_SIZE) {
              console.log(
                `Committing intermediate batch of ${modsInCurrentBatch} mods (Page ${page})...`,
              )
              await batch.commit()
              console.log(`Successfully committed intermediate batch.`)
              // Start a new batch for the remaining mods on this page
              batch = db.batch() // Re-initialize batch object
              modsInCurrentBatch = 0 // Reset counter
            }
          } else {
            // Log a warning if a mod object from the API is missing an ID
            console.warn(
              'Skipping mod write due to missing ID:',
              mod?.name_id || 'N/A',
            )
          }
        } // End of for...of loop processing mods for the current page

        // After processing all mods for the page, commit any remaining mods
        // that are in the last (potentially partially filled) batch.
        if (modsInCurrentBatch > 0) {
          console.log(
            `Committing final batch of ${modsInCurrentBatch} mods for page ${page}...`,
          )
          await batch.commit()
          console.log(`Successfully committed final batch for page ${page}.`)
        }

        console.log(
          `Finished processing page ${page}, wrote/updated ${totalModsWrittenThisPage} mods.`,
        )
      } catch (batchWriteError) {
        // Handle errors specifically from batch.commit()
        console.error(
          `Failed during Firestore batch write commit for page ${page}. Stopping cache process. Error:`,
          batchWriteError,
        )
        if ((batchWriteError as any).code) {
          console.error(`Error Code: ${(batchWriteError as any).code}`) // Log specific gRPC code if available
        }
        // Propagate the error to stop the entire process
        throw new Error(
          `Cache failed during Firestore batch write for page ${page}.`,
        )
      }

      // Add the count of mods processed on this page to the overall total
      totalModsWritten += totalModsWrittenThisPage

      // If the number of mods returned by the API was less than the requested page size,
      // we can assume it's the last page and stop fetching.
      if (mods.length < API_PAGE_SIZE) {
        console.log(
          `Workspaceed less than API_PAGE_SIZE (${mods.length}), assuming end of results.`,
        )
        break // Exit the while loop
      }

      // Increment offset and page number for the next fetch iteration
      offset += API_PAGE_SIZE
      page += 1

      // Optional: Add a small delay between processing pages to avoid overwhelming APIs
      // await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
    } // End of while loop fetching pages

    // Log overall success message after the loop finishes
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2) // Duration in seconds
    console.log(
      `✅ Successfully wrote/updated ${totalModsWritten} mods individually to collection '${TARGET_COLLECTION}' across ${page - 1} fetched pages in ${duration} seconds.`,
    )
  } catch (error) {
    // Catch errors propagated from fetch or batch write operations
    console.error(`⛔ Cache process failed overall:`, error)
    // Re-throw the error so the calling script (runCache.ts) knows it failed
    // and can exit with a non-zero status code.
    throw error
  }
}

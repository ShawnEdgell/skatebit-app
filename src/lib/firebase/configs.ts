import {
  collection,
  doc,
  getDocs,
  getDoc, // Import getDoc
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  type DocumentData,
  Timestamp,
  type FieldValue,
} from 'firebase/firestore'
import { auth, db } from './firebase' // Your firebase config import

/**
 * Metadata shape for each XML config in Firestore
 */
export type ConfigMeta = {
  fileName: string
  author: { uid: string; name: string | null }
  createdAt: Timestamp | FieldValue
  likesBy: string[]
  downloadCount: number
  description?: string // Optional description
  updatedAt?: Timestamp | FieldValue // Optional update timestamp
  xml?: string // Only present when fetching single doc with XML
}

/**
 * List all metadata for a given category
 */
export async function listConfigMeta(category: string): Promise<ConfigMeta[]> {
  const snap = await getDocs(collection(db, 'configs', category, 'files'))
  return snap.docs.map((d) => {
    // Cast to Partial to handle potentially missing fields in older data
    const data = d.data() as Partial<ConfigMeta>
    return {
      fileName: data.fileName ?? d.id,
      author: data.author ?? { uid: 'unknown', name: 'Unknown' },
      // Provide a client-side Timestamp fallback if needed
      createdAt: data.createdAt ?? Timestamp.now(),
      likesBy: data.likesBy ?? [],
      downloadCount: data.downloadCount ?? 0,
      description: data.description, // Read description if it exists
      updatedAt: data.updatedAt, // Pass through updatedAt if it exists
      // xml is not fetched here
      // Ensure the final object matches ConfigMeta structure
    } as ConfigMeta
  })
}

/**
 * Fetch the raw XML string for one config (or null if missing)
 */
export async function fetchConfigXml(
  category: string,
  fileName: string,
): Promise<string | null> {
  const ref = doc(db, 'configs', category, 'files', fileName)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  // Assume 'xml' field exists if document exists, adjust if needed
  return (snap.data() as DocumentData).xml as string
}

/**
 * Create or overwrite a config, now including an optional description
 */
export async function saveConfigXml(
  category: string,
  fileName: string,
  xml: string,
  description?: string, // Added optional description parameter
) {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  // Use the CORRECT path
  const ref = doc(db, 'configs', category, 'files', fileName)
  const snap = await getDoc(ref)

  // Use Partial<ConfigMeta> for the object being set
  const dataToSet: Partial<ConfigMeta> = {
    fileName,
    xml,
    author: { uid: u.uid, name: u.displayName ?? 'Anonymous' },
    updatedAt: serverTimestamp(), // Add/update the updatedAt timestamp
  }

  // Only add description if it's provided and not empty
  if (description && description.trim().length > 0) {
    dataToSet.description = description.trim() // Add description if present
  }

  if (!snap.exists()) {
    // Set initial values only for new documents
    dataToSet.createdAt = serverTimestamp()
    dataToSet.likesBy = []
    dataToSet.downloadCount = 0
    // Description is only added if provided above
  }
  // Use setDoc with merge: true for create or update logic here
  await setDoc(ref, dataToSet, { merge: true })
}

/**
 * Increment the download-count on a config
 */
export async function incrementDownloadCount(
  category: string,
  fileName: string,
) {
  // Use the CORRECT path
  const ref = doc(db, 'configs', category, 'files', fileName)
  try {
    // Increment count, or set to 1 if field doesn't exist yet
    await updateDoc(ref, { downloadCount: increment(1) })
  } catch (error: any) {
    if (error.code === 'not-found') {
      console.warn(
        `Document ${fileName} not found for download count increment.`,
      )
      // Optionally create the doc with count 1? Or just ignore.
    } else {
      throw error // Re-throw other errors
    }
  }
}

/**
 * Toggle the current user's like on/off
 */
export async function toggleLikeConfigXml(category: string, fileName: string) {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  // Use the CORRECT path
  const ref = doc(db, 'configs', category, 'files', fileName)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    console.warn(`Document ${fileName} not found for like toggle.`)
    throw new Error(`Config "${fileName}" not found.`)
  }

  // Read likes array, default to empty if missing
  const currentLikes: string[] = (snap.data() as DocumentData).likesBy || []

  if (currentLikes.includes(u.uid)) {
    // User currently likes it, remove like
    await updateDoc(ref, { likesBy: arrayRemove(u.uid) })
  } else {
    // User doesn't like it, add like
    await updateDoc(ref, { likesBy: arrayUnion(u.uid) })
  }
}

/**
 * Update specific metadata fields (like description) for a given config.
 * ADDED DETAILED LOGGING FOR DEBUGGING PERMISSIONS.
 */
export async function updateConfigMeta(
  category: string,
  fileName: string,
  // Only allow updating 'description'. 'updatedAt' is added automatically.
  updates: Partial<Pick<ConfigMeta, 'description'>>,
) {
  const functionName = '[updateConfigMeta]' // For easier log filtering
  const u = auth.currentUser

  // --- Log 1: Check Authentication State ---
  if (!u) {
    console.error(
      `${functionName} Update failed: User not signed in according to auth.currentUser.`,
    )
    throw new Error('Not signed in')
  }
  console.log(`${functionName} User authenticated: UID = ${u.uid}`)

  // --- Log 2: Define Document Reference ---
  const ref = doc(db, 'configs', category, 'files', fileName)
  console.log(`${functionName} Target document path: ${ref.path}`)

  try {
    // --- Log 3: Fetch Existing Document Data ---
    console.log(
      `${functionName} Fetching existing document to verify author...`,
    )
    const docSnap = await getDoc(ref)

    if (!docSnap.exists()) {
      console.error(`${functionName} Document not found at path: ${ref.path}`)
      throw new Error(`Config "${fileName}" not found.`)
    }

    const existingData = docSnap.data() as Partial<ConfigMeta>
    const authorUidInDoc = existingData.author?.uid
    console.log(
      `${functionName} Author UID in fetched document: ${authorUidInDoc}`,
    )

    // --- Log 4: Compare UIDs ---
    if (u.uid !== authorUidInDoc) {
      // This check should ideally be redundant if rules are correct, but good for debugging
      console.error(
        `${functionName} CRITICAL: UID Mismatch! Current user ${u.uid} is NOT the author ${authorUidInDoc}. Update will likely fail.`,
      )
      // Optionally throw an error here to stop before the update attempt
      // throw new Error('UID Mismatch detected before update attempt.');
    } else {
      console.log(`${functionName} UIDs match. Proceeding with update attempt.`)
    }

    // --- Log 5: Prepare Update Data ---
    const dataToUpdate = {
      ...updates, // Include the allowed fields (e.g., description)
      updatedAt: serverTimestamp(), // Always add/update the timestamp
    }
    console.log(`${functionName} Data being sent to updateDoc:`, dataToUpdate)

    // --- Perform the update ---
    await updateDoc(ref, dataToUpdate)
    console.log(`${functionName} updateDoc called successfully for ${fileName}`)
  } catch (error) {
    // Log the error before re-throwing or handling
    console.error(
      `${functionName} Error during updateDoc for ${fileName}:`,
      error,
    )
    // Re-throw the error so the calling function (handleSaveEdit) catches it
    throw error
  }
}

/**
 * Delete a config file entry IF the current user is the author
 */
export async function deleteConfigXml(category: string, fileName: string) {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  // Use the CORRECT path
  const ref = doc(db, 'configs', category, 'files', fileName)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    throw new Error(`Config "${fileName}" not found.`)
  }

  // Check author field for permission
  const configData = snap.data() as Partial<ConfigMeta> // Use Partial for safety
  if (configData.author?.uid !== u.uid) {
    throw new Error('You are not authorized to delete this config.')
  }

  await deleteDoc(ref)
}

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp, // Keep serverTimestamp
  arrayUnion,
  arrayRemove,
  increment,
  type DocumentData,
  Timestamp, // <-- Changed to regular import
  type FieldValue, // <-- Import FieldValue type
} from 'firebase/firestore'
import { auth, db } from './firebase'

/**
 * Metadata shape for each XML config in Firestore
 */
export type ConfigMeta = {
  fileName: string
  author: { uid: string; name: string | null }
  // Allow FieldValue during writes, reads will be Timestamp
  createdAt: Timestamp | FieldValue
  likesBy: string[]
  downloadCount: number
  description?: string // <-- Added optional description
  // Add optional updatedAt, allow FieldValue for writes
  updatedAt?: Timestamp | FieldValue
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
      description: data.description, // <-- Read description if it exists
      updatedAt: data.updatedAt,
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
  description?: string, // <-- Added optional description parameter
) {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
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
    dataToSet.description = description.trim() // <-- Add description if present
  }

  if (!snap.exists()) {
    // Set initial values only for new documents
    dataToSet.createdAt = serverTimestamp()
    dataToSet.likesBy = []
    dataToSet.downloadCount = 0
    // If description wasn't provided for a new doc, it won't be set initially
  } else {
    // If updating and no description provided, ensure it doesn't overwrite
    // an existing description unless explicitly setting it to empty/null.
    // The current logic only adds it if provided, otherwise leaves it untouched
    // due to { merge: true }. If you want to explicitly clear it, add:
    // else if (!description || description.trim().length === 0) {
    //   dataToSet.description = null; // Or deleteField() if preferred
    // }
  }

  // Use merge: true to update existing fields and add new ones
  await setDoc(ref, dataToSet, { merge: true })
}

/**
 * Increment the download-count on a config
 */
export async function incrementDownloadCount(
  category: string,
  fileName: string,
) {
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
 * Update just the metadata (e.g. description) for a given config.
 */
export async function updateConfigMeta(
  category: string,
  fileName: string,
  updates: Partial<Pick<ConfigMeta, 'fileName' | 'description'>>,
) {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  const ref = doc(db, 'userConfigs', u.uid, category, fileName)
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Delete a config file entry IF the current user is the author
 */
export async function deleteConfigXml(category: string, fileName: string) {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')

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

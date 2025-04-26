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
  Timestamp, // <-- Change 'import type' to regular import
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
  // Add optional updatedAt, allow FieldValue for writes
  updatedAt?: Timestamp | FieldValue
  xml?: string
}

/**
 * List all metadata for a given category
 */
export async function listConfigMeta(category: string): Promise<ConfigMeta[]> {
  const snap = await getDocs(collection(db, 'configs', category, 'files'))
  return snap.docs.map((d) => {
    const data = d.data() as Partial<ConfigMeta>
    return {
      fileName: data.fileName ?? d.id,
      author: data.author ?? { uid: 'unknown', name: 'Unknown' },
      // Provide a client-side Timestamp fallback if needed, ensuring it's Timestamp type after read
      createdAt: data.createdAt ?? Timestamp.now(),
      likesBy: data.likesBy ?? [],
      downloadCount: data.downloadCount ?? 0,
      updatedAt: data.updatedAt, // Pass through updatedAt if it exists
      // xml is not fetched here
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
  return (snap.data() as DocumentData).xml as string
}

/**
 * Create or overwrite a config
 */
export async function saveConfigXml(
  category: string,
  fileName: string,
  xml: string,
) {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  const ref = doc(db, 'configs', category, 'files', fileName)
  const snap = await getDoc(ref)

  // Use Partial<ConfigMeta> for the object being set, TS is now okay with FieldValue
  const dataToSet: Partial<ConfigMeta> = {
    fileName,
    xml,
    author: { uid: u.uid, name: u.displayName ?? 'Anonymous' },
    updatedAt: serverTimestamp(), // Add/update the updatedAt timestamp
  }

  if (!snap.exists()) {
    // Set initial values only for new documents
    dataToSet.createdAt = serverTimestamp() // This is now assignable
    dataToSet.likesBy = []
    dataToSet.downloadCount = 0
  }

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
    await updateDoc(ref, { downloadCount: increment(1) })
  } catch (error: any) {
    if (error.code === 'not-found') {
      console.warn(
        `Document ${fileName} not found for download count increment.`,
      )
    } else {
      throw error
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

  // Cast needed here as read data will always be Timestamp
  const configData = snap.data() as Omit<
    ConfigMeta,
    'createdAt' | 'updatedAt'
  > & { createdAt: Timestamp; updatedAt?: Timestamp }
  const currentLikes: string[] = configData.likesBy || []

  if (currentLikes.includes(u.uid)) {
    await updateDoc(ref, { likesBy: arrayRemove(u.uid) })
  } else {
    await updateDoc(ref, { likesBy: arrayUnion(u.uid) })
  }
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

  // Cast needed here as read data will always be Timestamp
  const configData = snap.data() as Omit<
    ConfigMeta,
    'createdAt' | 'updatedAt'
  > & { createdAt: Timestamp; updatedAt?: Timestamp }

  if (configData.author?.uid !== u.uid) {
    throw new Error('You are not authorized to delete this config.')
  }

  await deleteDoc(ref)
}

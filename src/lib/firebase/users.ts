import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  type Timestamp,
  type FieldValue,
} from 'firebase/firestore'
import { db, auth } from './firebase' // Your firebase config import

// Define the structure for the user profile data
export type UserProfile = {
  uid: string
  name: string | null
  email: string | null
  photoURL: string | null
  bio?: string
  discord?: string
  tiktok?: string
  youtube?: string
  instagram?: string
  twitch?: string
  updatedAt?: Timestamp | FieldValue
}

/**
 * Fetches a user's profile data from Firestore.
 * Returns null if the profile doesn't exist.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!uid) return null
  try {
    const profileRef = doc(db, 'userProfiles', uid)
    const docSnap = await getDoc(profileRef)

    if (docSnap.exists()) {
      // Combine Firestore data with potentially updated Auth data
      const profileData = docSnap.data() as Partial<UserProfile>
      const currentUser = auth.currentUser // Get current auth state

      return {
        uid: uid,
        name:
          currentUser?.uid === uid
            ? currentUser?.displayName
            : (profileData.name ?? null),
        email:
          currentUser?.uid === uid
            ? currentUser?.email
            : (profileData.email ?? null),
        photoURL:
          currentUser?.uid === uid
            ? currentUser?.photoURL
            : (profileData.photoURL ?? null),
        bio: profileData.bio ?? '',
        discord: profileData.discord ?? '',
        tiktok: profileData.tiktok ?? '',
        youtube: profileData.youtube ?? '',
        instagram: profileData.instagram ?? '',
        updatedAt: profileData.updatedAt as Timestamp | undefined, // Cast read data
      }
    } else {
      // Profile doesn't exist in Firestore yet
      console.log(`No profile found for UID: ${uid}`)
      // Optionally create a default profile based on auth data if needed here
      return null
    }
  } catch (error) {
    console.error('Error fetching user profile:', error)
    // Propagate error or return null based on desired behavior
    throw error // Or return null;
  }
}

/**
 * Creates or updates a user's profile data in Firestore.
 */
export async function updateUserProfile(
  uid: string,
  data: Partial<
    Omit<UserProfile, 'uid' | 'email' | 'updatedAt' | 'name' | 'photoURL'>
  > & { twitter?: string; twitch?: string }, // allow setting them
): Promise<void> {
  if (!uid) throw new Error('User ID is required')
  const profileRef = doc(db, 'userProfiles', uid)

  // Only send the fields your rules allow (no uid here!)
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
  }

  await updateDoc(profileRef, payload)
}

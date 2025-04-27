import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Timestamp,
  type FieldValue,
} from 'firebase/firestore'
import { db, auth } from './firebase' // Your firebase config import

// Define the structure for the user profile data
export type UserProfile = {
  uid: string // Ensure UID is stored for reference
  name: string | null // Display name (sync with auth?)
  email: string | null // Email (sync with auth?)
  photoURL: string | null // Profile picture URL (sync with auth?)
  bio?: string // Optional short bio
  discord?: string // Optional Discord username or invite link
  tiktok?: string // Optional TikTok profile URL
  youtube?: string // Optional YouTube channel URL
  instagram?: string // Optional Instagram profile URL
  // Add other social links as needed
  updatedAt?: Timestamp | FieldValue // Track updates
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
  >,
): Promise<void> {
  if (!uid) throw new Error('User ID is required to update profile.')

  const profileRef = doc(db, 'userProfiles', uid)
  const dataToSet = {
    ...data, // Include fields like bio, discord, tiktok, etc.
    uid: uid, // Ensure UID is set
    updatedAt: serverTimestamp(), // Always update timestamp
  }

  try {
    // Use setDoc with merge: true to create or update
    await setDoc(profileRef, dataToSet, { merge: true })
    console.log(`Profile updated successfully for UID: ${uid}`)
  } catch (error) {
    console.error('Error updating user profile:', error)
    throw error // Re-throw the error to be handled by the caller
  }
}

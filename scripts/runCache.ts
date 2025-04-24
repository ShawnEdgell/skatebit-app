// scripts/runCache.ts

import * as admin from 'firebase-admin'
// Adjust the import path based on your project structure
import { cacheAllMapModsToFirestore } from '../src/lib/api/modioCache'

async function main() {
  console.log('🚀 Starting Firestore cache update script...')

  // 1. Load Configuration from Environment Variables (set by GitHub Actions)
  const serviceAccountJsonString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  const modioApiKey = process.env.MODIO_API_KEY
  const modioDomain = process.env.MODIO_DOMAIN

  // Validate required environment variables
  if (!serviceAccountJsonString) {
    console.error(
      '❌ Error: FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set.',
    )
    process.exit(1) // Exit with failure code
  }
  if (!modioApiKey) {
    console.error('❌ Error: MODIO_API_KEY environment variable is not set.')
    process.exit(1) // Exit with failure code
  }
  if (!modioDomain) {
    console.error('❌ Error: MODIO_DOMAIN environment variable is not set.')
    process.exit(1) // Exit with failure code
  }

  try {
    // 2. Initialize Firebase Admin SDK
    console.log('Initializing Firebase Admin SDK...')
    const serviceAccount = JSON.parse(serviceAccountJsonString)

    // Prevent re-initialization error if somehow run multiple times in same process
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // Optional: Specify database URL if needed, usually inferred from projectId
        // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
      })
      console.log('Firebase Admin SDK initialized successfully.')
    } else {
      console.log('Firebase Admin SDK already initialized.')
      // Use the existing default app if already initialized
      // admin.app();
    }

    const db = admin.firestore() // Get Firestore instance from Admin SDK

    // 3. Run the Caching Logic
    console.log('Calling cacheAllMapModsToFirestore function...')
    // Pass the Admin DB instance and API credentials
    await cacheAllMapModsToFirestore(db, modioApiKey, modioDomain)

    console.log('✅ Script finished successfully.')
    process.exit(0) // Explicitly exit with success code
  } catch (error) {
    console.error('❌ Script encountered an error:', error)
    process.exit(1) // Explicitly exit with failure code
  }
}

// Execute the main function
main()

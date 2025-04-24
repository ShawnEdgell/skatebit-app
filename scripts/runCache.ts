// scripts/runCache.ts
import * as admin from 'firebase-admin'
// Import specific functions we need from the admin SDK's sub-packages
import { initializeApp, cert, getApp, App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore' // Import getFirestore

import { cacheAllMapModsToFirestore } from '../src/lib/api/modioCache' // Adjust path

async function main() {
  console.log('🚀 Starting Firestore cache update script...')

  const serviceAccountJsonString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  const modioApiKey = process.env.MODIO_API_KEY
  const modioDomain = process.env.MODIO_DOMAIN

  if (!serviceAccountJsonString || !modioApiKey || !modioDomain) {
    console.error(
      '❌ Error: Missing one or more required environment variables (FIREBASE_SERVICE_ACCOUNT_JSON, MODIO_API_KEY, MODIO_DOMAIN).',
    )
    process.exit(1)
  }

  try {
    console.log('Parsing service account JSON...')
    const serviceAccount = JSON.parse(serviceAccountJsonString)

    console.log(
      'Initializing Firebase Admin SDK (using getApp/initializeApp)...',
    )

    let adminApp: App // Define variable to hold the App instance

    try {
      // Try to get the existing default app instance
      adminApp = getApp()
      console.log('Firebase Admin SDK already initialized.')
    } catch (error: any) {
      // If getApp() throws, no default app exists, so initialize it
      if (error.code === 'app/no-app') {
        console.log('No existing Firebase app found, initializing new one...')
        adminApp = initializeApp({
          credential: cert(serviceAccount), // Use cert() from firebase-admin/app
          // databaseURL: `https://${serviceAccount.project_id}.firebaseio.com` // Optional
        })
        console.log('Firebase Admin SDK initialized successfully.')
      } else {
        // Rethrow unexpected errors from getApp()
        throw error
      }
    }

    // Get the Firestore instance from the initialized app
    const db = getFirestore(adminApp)
    console.log('Firestore Admin instance obtained.')

    // 3. Run the Caching Logic
    console.log('Calling cacheAllMapModsToFirestore function...')
    // Pass the Admin DB instance and API credentials
    await cacheAllMapModsToFirestore(db, modioApiKey, modioDomain) // Pass db directly

    console.log('✅ Script finished successfully.')
    process.exit(0)
  } catch (error) {
    console.error('❌ Script encountered an error:', error)
    process.exit(1)
  }
}

main()

// scripts/runCache.ts
import * as admin from 'firebase-admin' // Keep for potential other admin uses, though not strictly needed below
import { initializeApp, cert, getApp, App } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore' // Import FieldValue if used within cacheAllMapModsToFirestore

// Adjust the import path based on your project structure
import { cacheAllMapModsToFirestore } from '../src/lib/api/modioCache'

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
    let adminApp: App
    try {
      adminApp = getApp() // Try getting existing default app
      console.log('Firebase Admin SDK already initialized.')
    } catch (error: any) {
      if (error.code === 'app/no-app') {
        // If no app exists, initialize
        console.log('No existing Firebase app found, initializing new one...')
        adminApp = initializeApp({ credential: cert(serviceAccount) })
        console.log('Firebase Admin SDK initialized successfully.')
      } else {
        throw error
      } // Rethrow other errors
    }

    const db = getFirestore(adminApp) // Get Firestore instance
    console.log('Firestore Admin instance obtained.')

    // Run the Caching Logic
    console.log('Calling cacheAllMapModsToFirestore function...')
    await cacheAllMapModsToFirestore(db, modioApiKey, modioDomain)

    console.log('✅ Script finished successfully.')
    process.exit(0)
  } catch (error) {
    console.error('❌ Script encountered an error:', error)
    process.exit(1)
  }
}

main()

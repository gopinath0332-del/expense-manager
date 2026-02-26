/**
 * Firebase initialization module.
 *
 * Reads credentials from Vite environment variables (VITE_FIREBASE_*).
 * Set VITE_USE_FIREBASE_EMULATOR=true in .env to connect to local emulators.
 *
 * Usage:
 *   import { db } from '@/firebase'
 */
import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

// Firebase project configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Initialize the Firebase app singleton
const app = initializeApp(firebaseConfig)

// Initialize Firestore and export for use throughout the app
export const db = getFirestore(app)

// Connect to local Firestore emulator when VITE_USE_FIREBASE_EMULATOR=true
// This avoids touching production data during development/testing
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  // Default emulator host and port from `firebase emulators:start`
  connectFirestoreEmulator(db, 'localhost', 8080)
  console.info('[Firebase] Connected to Firestore emulator at localhost:8080')
}

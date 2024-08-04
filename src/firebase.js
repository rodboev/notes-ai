import { initializeApp } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'
import {
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

import dotenv from 'dotenv'

dotenv.config()

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  // databaseURL: process.env.FIREBASE_DATABASE_URL,
}

const app = initializeApp(firebaseConfig)

const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSize: 'CACHE_SIZE_UNLIMITED',
  }),
})

export { firestore }

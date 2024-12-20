import { firestore } from '../firebase.js'
import { writeBatch, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'

const enabled = true

let quotaExceededLogged = false
const QUOTA_RESET_INTERVAL = 60 * 60 * 1000 // 1 hour

const resetQuotaExceededLog = () => {
  quotaExceededLogged = false
}

setInterval(resetQuotaExceededLog, QUOTA_RESET_INTERVAL)

export const safeDocRef = (firestore, collectionName, document) => {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    console.warn('Invalid document:', document)
    return null
  }

  if (
    !document.fingerprint ||
    typeof document.fingerprint !== 'string' ||
    document.fingerprint.trim() === ''
  ) {
    return null
  }

  try {
    return doc(firestore, collectionName, document.fingerprint)
  } catch (error) {
    console.error('Error creating doc reference for document:', document, error)
    return null
  }
}

export const firestoreBatchGet = async (collectionName, docIds) => {
  if (!enabled) return []
  try {
    const collectionRef = collection(firestore, collectionName)
    const docSnapshots = await Promise.all(docIds.map((id) => getDoc(doc(collectionRef, id))))
    return docSnapshots.map((snap) => (snap.exists() ? snap.data() : null))
  } catch (error) {
    handleFirestoreError(error)
    return []
  }
}

export const firestoreBatchWrite = async (collectionName, documents) => {
  if (!enabled) return null

  const batch = writeBatch(firestore)
  let validOperations = 0
  let skippedOperations = 0

  documents.forEach((document, index) => {
    const ref = safeDocRef(firestore, collectionName, document)
    if (ref) {
      batch.set(ref, document)
      validOperations++
    } else {
      skippedOperations++
    }
  })

  if (validOperations === 0) {
    console.warn('No valid operations to write to Firestore')
    return { validOperations, skippedOperations }
  }

  try {
    await batch.commit()
    console.log(`Successfully wrote ${validOperations} documents to Firestore`)
  } catch (error) {
    handleFirestoreError(error)
    return { validOperations: 0, skippedOperations: documents.length, error }
  }

  if (skippedOperations > 0) {
    console.warn(`Skipped ${skippedOperations} invalid documents`)
  }

  return { validOperations, skippedOperations }
}

export const firestoreGetDoc = async (collectionName, docId) => {
  if (!enabled) return null
  try {
    const docRef = doc(firestore, collectionName, docId)
    const docSnap = await getDoc(docRef)
    return docSnap.exists() ? docSnap.data() : null
  } catch (error) {
    handleFirestoreError(error)
  }
}

export const firestoreGetAllDocs = async (collectionName) => {
  if (!enabled) return []
  try {
    const collectionRef = collection(firestore, collectionName)
    const snapshot = await getDocs(collectionRef)
    return snapshot.docs.map((doc) => doc.data())
  } catch (error) {
    handleFirestoreError(error)
    return []
  }
}

export async function firestoreSetDoc(collectionName, data, options = {}) {
  if (!enabled) return null

  try {
    if (Array.isArray(data)) {
      return handleArrayData(collectionName, data, options)
    }

    if (typeof data === 'object' && data !== null) {
      return handleSingleDocument(collectionName, data, options)
    }

    throw new Error(
      'Invalid data format: must be an array of documents or a single document object with a fingerprint',
    )
  } catch (error) {
    handleFirestoreError(error)
    return { validOperations: 0, skippedOperations: Array.isArray(data) ? data.length : 1, error }
  }
}

async function handleArrayData(collectionName, data, options) {
  const batch = writeBatch(firestore)
  let validOperations = 0
  let skippedOperations = 0

  for (const [, item] of Object.entries(data)) {
    if (item.fingerprint) {
      const docRef = doc(firestore, collectionName, item.fingerprint)
      batch.set(docRef, item, options)
      validOperations++
    } else {
      console.warn('Item missing fingerprint:', item)
      skippedOperations++
    }
  }

  if (validOperations === 0) {
    console.warn('No valid operations to write to Firestore')
    return { validOperations, skippedOperations }
  }

  await batch.commit()
  console.log(`Successfully wrote ${validOperations} documents to Firestore`)

  if (skippedOperations > 0) {
    console.warn(`Skipped ${skippedOperations} invalid documents`)
  }

  return { validOperations, skippedOperations }
}

async function handleSingleDocument(collectionName, data, options) {
  if (!data.fingerprint) {
    throw new Error('Invalid data format: single document must have a fingerprint')
  }
  const docRef = doc(firestore, collectionName, data.fingerprint)
  await setDoc(docRef, data, options)
  console.log(`Successfully wrote document with fingerprint ${data.fingerprint} to Firestore`)
  return { validOperations: 1, skippedOperations: 0 }
}

const handleFirestoreError = (error) => {
  console.error('Firestore operation failed:', error)
  if (error.code === 'resource-exhausted' && !quotaExceededLogged) {
    console.error('Firestore quota exceeded. Further writes will be disabled for this session.')
    quotaExceededLogged = true
  }
  throw error
}

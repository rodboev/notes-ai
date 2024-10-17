// src/utils/firestoreHelper.js

import { firestore } from '../../firebase'
import { writeBatch, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'

const enabled = true

let quotaExceededLogged = false
const QUOTA_RESET_INTERVAL = 60 * 60 * 1000 // 1 hour

const resetQuotaExceededLog = () => {
  quotaExceededLogged = false
}

setInterval(resetQuotaExceededLog, QUOTA_RESET_INTERVAL)

const writeQueue = {
  notes: [],
  emails: [],
}
const BATCH_SIZE = 20 // Process 20 pairs at a time

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

    if (typeof data === 'object' && data !== null && data.fingerprint) {
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

export function queueWrite(collectionName, documents) {
  if (collectionName !== 'notes' && collectionName !== 'emails') {
    console.warn(`Invalid collection name: ${collectionName}`)
    return
  }
  if (documents.length === 0) {
    return // Silently return if there's nothing to queue
  }
  writeQueue[collectionName].push(...documents)

  // Only log if documents were actually added to the queue
  console.log(`Queued ${documents.length} ${collectionName}. Current queue:`, {
    notes: writeQueue.notes.length,
    emails: writeQueue.emails.length,
  })

  // Only process if we have at least BATCH_SIZE pairs
  if (writeQueue.notes.length >= BATCH_SIZE && writeQueue.emails.length >= BATCH_SIZE) {
    processWriteQueue()
  }
}

async function processWriteQueue() {
  if (writeQueue.notes.length !== writeQueue.emails.length) {
    console.warn(`Firestore queue is unbalanced: ${notes.length} notes, ${emails.length} emails.`)
  }
  if (writeQueue.notes.length === 0 || writeQueue.emails.length === 0) {
    return // Silently return if either queue is empty
  }

  const pairedDocuments = writeQueue.notes.filter((note) =>
    writeQueue.emails.some((email) => email.fingerprint === note.fingerprint),
  )

  if (pairedDocuments.length === 0) {
    return // Silently return if there are no matching pairs
  }

  const matchingEmails = writeQueue.emails.filter((email) =>
    pairedDocuments.some((note) => note.fingerprint === email.fingerprint),
  )

  try {
    const batch = writeBatch(firestore)
    let operationCount = 0
    const MAX_BATCH_SIZE = 500 // Firestore's limit

    for (let i = 0; i < pairedDocuments.length && operationCount < MAX_BATCH_SIZE; i++) {
      const noteRef = safeDocRef(firestore, 'notes', pairedDocuments[i])
      const emailRef = safeDocRef(firestore, 'emails', matchingEmails[i])

      if (noteRef && emailRef) {
        batch.set(noteRef, pairedDocuments[i])
        batch.set(emailRef, matchingEmails[i])
        operationCount += 2
      }
    }

    if (operationCount === 0) {
      return // Silently return if there are no valid operations
    }

    await batch.commit()
    console.log(`Successfully wrote ${operationCount} documents to Firestore`)

    // Remove processed items from the queue
    writeQueue.notes = writeQueue.notes.slice(pairedDocuments.length)
    writeQueue.emails = writeQueue.emails.slice(matchingEmails.length)

    console.log(
      `Remaining in queue: ${writeQueue.notes.length} notes, ${writeQueue.emails.length} emails`,
    )

    // If there are still items in the queue, process again
    if (writeQueue.notes.length >= BATCH_SIZE && writeQueue.emails.length >= BATCH_SIZE) {
      processWriteQueue()
    }
  } catch (error) {
    console.error('Error processing write queue:', error)
    handleFirestoreError(error)
  }
}

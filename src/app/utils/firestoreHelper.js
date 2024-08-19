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

const handleFirestoreError = (error) => {
  if (error.code === 'resource-exhausted' && !quotaExceededLogged) {
    console.error('Firestore quota exceeded. Operations will be paused.')
    quotaExceededLogged = true
  } else if (error.code !== 'resource-exhausted') {
    console.error('Firestore error:', error)
  }
  throw error
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

export const firestoreBatchWrite = async (operations) => {
  if (!enabled) return null
  try {
    const batch = writeBatch(firestore)
    operations.forEach((op) => {
      const { type, ref, data } = op
      if (type === 'set') {
        batch.set(ref, data)
      } else if (type === 'update') {
        batch.update(ref, data)
      } else if (type === 'delete') {
        batch.delete(ref)
      }
    })
    await batch.commit()
  } catch (error) {
    handleFirestoreError(error)
  }
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

export const firestoreSetDoc = async (collectionName, docId, data, options = {}) => {
  if (!enabled) return null
  try {
    const docRef = doc(firestore, collectionName, docId)
    await setDoc(docRef, data, options)
  } catch (error) {
    handleFirestoreError(error)
  }
}

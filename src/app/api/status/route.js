// src/app/api/status/route.js

import { readFromDisk, writeToDisk, deleteFromDisk } from '../../utils/diskStorage'
import { firestore } from '../../../firebase.js'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'

const STATUS_DOC_ID = 'emailStatuses'

export async function loadStatuses() {
  // console.log(`Loading email statuses from disk`)
  try {
    const diskStatuses = await readFromDisk('status.json')
    if (diskStatuses) {
      return diskStatuses
    }

    console.log(`Statuses not found on disk, loading from Firestore`)
    const statusesRef = doc(firestore, 'emails', STATUS_DOC_ID)
    const statusesDoc = await getDoc(statusesRef)
    const statuses = statusesDoc.exists() ? statusesDoc.data() : {}
    await writeToDisk('status.json', statuses)
    return statuses
  } catch (error) {
    console.error(`Error loading email statuses:`, error)
    return {}
  }
}

export async function saveStatuses(newStatuses) {
  let logStr = ''
  try {
    await writeToDisk('status.json', newStatuses)
    logStr += 'Email statuses saved to disk'

    const statusesRef = doc(firestore, 'emails', STATUS_DOC_ID)
    await setDoc(statusesRef, newStatuses, { merge: true })
    logStr += ' and Firestore'
    console.log(logStr)

    return newStatuses
  } catch (error) {
    console.log(logStr)
    console.error(`Error saving email statuses:`, error)
    throw error
  }
}

export async function GET(req) {
  try {
    const url = new URL(req.url)
    if (url.searchParams.has('delete')) {
      return await DELETE(req)
    }

    const statuses = await loadStatuses()
    return new Response(JSON.stringify(statuses), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching statuses:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch statuses' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function POST(req) {
  try {
    const newStatus = await req.json()
    const existingStatuses = await loadStatuses()

    // Merge the new status with existing statuses
    const updatedStatuses = { ...existingStatuses, ...newStatus }

    await saveStatuses(updatedStatuses)

    return new Response(
      JSON.stringify({
        message: 'Statuses updated successfully',
        statuses: updatedStatuses,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error updating statuses:', error)
    return new Response(JSON.stringify({ error: 'Failed to update statuses' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function DELETE(req) {
  try {
    // Delete from disk
    await deleteFromDisk('status.json')

    // Delete from Firestore
    const statusesRef = doc(firestore, 'emails', STATUS_DOC_ID)
    await deleteDoc(statusesRef)

    return new Response(JSON.stringify({ message: 'Statuses deleted successfully' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error deleting statuses:', error)
    return new Response(JSON.stringify({ error: 'Failed to delete statuses' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

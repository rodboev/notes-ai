// src/app/api/status/route.js

import { readFromDisk, writeToDisk } from '../../utils/diskStorage'
import { firestore } from '../../../firebase.js'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const STATUS_COLLECTION = 'status'
const EMAILS_DOC_ID = 'emails'

async function loadStatuses() {
  try {
    console.log('Attempting to read statuses from disk...')
    const diskStatuses = await readFromDisk('status.json')
    if (diskStatuses && Object.keys(diskStatuses).length > 0) {
      return diskStatuses
    }

    console.log('Statuses not found on disk or empty, loading from Firestore...')
    const statusesRef = doc(firestore, STATUS_COLLECTION, EMAILS_DOC_ID)
    const statusesDoc = await getDoc(statusesRef)
    const statuses = statusesDoc.exists() ? statusesDoc.data() : {}

    if (Object.keys(statuses).length > 0) {
      console.log('Writing Firestore data to disk...')
      await writeToDisk('status.json', statuses)
    }

    return statuses
  } catch (error) {
    console.error(`Error loading email statuses:`, error)
    return {}
  }
}

async function saveStatus(fingerprint, newStatus) {
  try {
    const allStatuses = await loadStatuses()
    allStatuses[fingerprint] = newStatus

    await writeToDisk('status.json', allStatuses)
    console.log('Email status saved to disk')

    const statusesRef = doc(firestore, STATUS_COLLECTION, EMAILS_DOC_ID)
    await setDoc(statusesRef, { [fingerprint]: newStatus }, { merge: true })
    console.log('Email status saved to Firestore')

    return newStatus
  } catch (error) {
    console.error(`Error saving email status:`, error)
    throw error
  }
}

export async function GET(req) {
  try {
    const url = new URL(req.url)
    const fingerprint = url.searchParams.get('fingerprint')

    if (!fingerprint) {
      return new Response(JSON.stringify({ error: 'Fingerprint parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`Attempting to load status for fingerprint: ${fingerprint}`)
    const allStatuses = await loadStatuses()
    const status = allStatuses[fingerprint] || null

    return new Response(JSON.stringify({ [fingerprint]: status }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching status:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function PATCH(req) {
  try {
    const { fingerprint, status } = await req.json()

    if (!fingerprint || !status) {
      return new Response(JSON.stringify({ error: 'Fingerprint and status are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const updatedStatus = await saveStatus(fingerprint, status)

    return new Response(
      JSON.stringify({
        message: 'Status updated successfully',
        status: updatedStatus,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error updating status:', error)
    return new Response(JSON.stringify({ error: 'Failed to update status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

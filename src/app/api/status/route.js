// src/app/api/status/route.js

import { readFromDisk, writeToDisk } from '../../utils/diskStorage'
import { firestoreGetDoc, firestoreSetDoc } from '../../utils/firestoreHelper'
import { timestamp } from '../../utils/timestamp'

const STATUS_COLLECTION = 'status'
const EMAILS_DOC_ID = 'emails'

export async function loadStatuses() {
  try {
    const diskStatuses = await readFromDisk('status.json')
    if (diskStatuses && Object.keys(diskStatuses).length > 0) {
      return diskStatuses
    }

    console.log(`${timestamp()} Statuses not found on disk or empty, loading from Firestore...`)
    const statusesData = await firestoreGetDoc(STATUS_COLLECTION, EMAILS_DOC_ID)
    const statuses = statusesData || {}

    if (Object.keys(statuses).length > 0) {
      console.log(`${timestamp()} Writing Firestore data to disk...`)
      await writeToDisk('status.json', statuses)
    }

    return statuses
  } catch (error) {
    console.error(`${timestamp()} Error loading email statuses:`, error.message)
    return {}
  }
}

export async function saveStatus(fingerprint, newStatus) {
  try {
    const allStatuses = await loadStatuses()
    const hasChanges = JSON.stringify(allStatuses[fingerprint]) !== JSON.stringify(newStatus)

    if (hasChanges) {
      allStatuses[fingerprint] = newStatus

      await writeToDisk('status.json', allStatuses)
      console.log(`${timestamp()} Email status saved to disk`)

      console.log(`${timestamp()} Changes detected in statuses. Triggering Firestore write`)
      await firestoreSetDoc(
        STATUS_COLLECTION,
        EMAILS_DOC_ID,
        { [fingerprint]: newStatus },
        { merge: true },
      )
      console.log(`${timestamp()} Email status saved to Firestore`)
    } else {
      console.log(`${timestamp()} No changes detected, skipping save operation`)
    }

    return newStatus
  } catch (error) {
    console.error(`${timestamp()} Error saving email status:`, error.message)
    throw error
  }
}

export async function GET(req) {
  try {
    const url = new URL(req.url)
    const fingerprints = url.searchParams.get('fingerprints')?.split(',') || []

    if (fingerprints.length === 0) {
      return new Response(JSON.stringify({ error: 'Fingerprints parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const allStatuses = await loadStatuses()
    const statuses = fingerprints.reduce((acc, fingerprint) => {
      acc[fingerprint] = allStatuses[fingerprint] || null
      return acc
    }, {})

    return new Response(JSON.stringify(statuses), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error(`${timestamp()} Error fetching statuses:`, error.message)
    return new Response(JSON.stringify({ error: 'Failed to fetch statuses' }), {
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
    console.error(`${timestamp()} Error updating status:`, error.message)
    return new Response(JSON.stringify({ error: 'Failed to update status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

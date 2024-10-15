import { readFromDisk, writeToDisk } from '../../utils/diskStorage.js'
import { firestoreGetAllDocs, firestoreSetDoc } from '../../utils/firestoreHelper.js'
import { timestamp } from '../../utils/timestamp.js'

const STATUS_COLLECTION = 'status'

export async function loadStatuses() {
  try {
    const diskStatuses = await readFromDisk('status.json')
    if (diskStatuses && Object.keys(diskStatuses).length > 0) {
      return diskStatuses
    }

    console.log(`${timestamp()} Statuses not found on disk or empty, loading from Firestore...`)
    const statusesArray = await firestoreGetAllDocs(STATUS_COLLECTION)
    const statuses = statusesArray.reduce((acc, status) => {
      if (status.fingerprint) {
        acc[status.fingerprint] = status
      }
      return acc
    }, {})

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
    const currentStatus = allStatuses[fingerprint] || {}

    const updatedStatus = {
      ...newStatus,
      fingerprint,
      updatedAt: new Date().toISOString(),
    }

    const hasChanges = JSON.stringify(currentStatus) !== JSON.stringify(updatedStatus)

    if (hasChanges) {
      allStatuses[fingerprint] = updatedStatus

      await writeToDisk('status.json', allStatuses)
      console.log(`${timestamp()} Email status saved to disk`)

      console.log(`${timestamp()} Changes detected in statuses. Triggering Firestore write`)
      await firestoreSetDoc(STATUS_COLLECTION, fingerprint, updatedStatus)
      console.log(`${timestamp()} Email status saved to Firestore`)
    } else {
      console.log(`${timestamp()} No changes detected, skipping save operation`)
    }

    return updatedStatus
  } catch (error) {
    console.error(`${timestamp()} Error saving email status:`, error.message)
    throw error
  }
}

export const get = async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const fingerprints = url.searchParams.get('fingerprints')?.split(',') || []

    if (fingerprints.length === 0) {
      res.status(400).json({ error: 'Fingerprints parameter is required' })
      return
    }

    const allStatuses = await loadStatuses()
    const statuses = fingerprints.reduce((acc, fingerprint) => {
      acc[fingerprint] = allStatuses[fingerprint] || null
      return acc
    }, {})

    res.status(200).json(statuses)
  } catch (error) {
    console.error(`${timestamp()} Error fetching statuses:`, error.message)
    res.status(500).json({ error: 'Failed to fetch statuses' })
  }
}

export const patch = async (req, res) => {
  try {
    const { fingerprint, status } = await req.json()

    if (!fingerprint || !status) {
      res.status(400).json({ error: 'Fingerprint and status are required' })
      return
    }

    const updatedStatus = await saveStatus(fingerprint, status)

    res.status(200).json({
      message: 'Status updated successfully',
      status: updatedStatus,
    })
  } catch (error) {
    console.error(`${timestamp()} Error updating status:`, error.message)
    res.status(500).json({ error: 'Failed to update status' })
  }
}

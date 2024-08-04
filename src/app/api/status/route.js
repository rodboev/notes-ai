import { firestore } from '../../../firebase.js'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const STATUS_DOC_ID = 'emailStatuses'

async function loadStatuses() {
  console.log(`Loading email statuses from Firestore`)
  try {
    const statusesRef = doc(firestore, 'emails', STATUS_DOC_ID)
    const statusesDoc = await getDoc(statusesRef)
    return statusesDoc.exists() ? statusesDoc.data() : {}
  } catch (error) {
    console.error(`Error loading email statuses from Firestore:`, error)
    return {}
  }
}

async function saveStatuses(statuses) {
  console.log(`Saving email statuses to Firestore`)
  try {
    const statusesRef = doc(firestore, 'emails', STATUS_DOC_ID)
    await setDoc(statusesRef, statuses, { merge: true })
    console.log('Email statuses saved successfully')
  } catch (error) {
    console.error(`Error saving email statuses to Firestore:`, error)
  }
}

export async function GET(req) {
  try {
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
    const newStatuses = await req.json()
    await saveStatuses(newStatuses)
    return new Response(
      JSON.stringify({ message: 'Statuses updated successfully' }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error updating statuses:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to update statuses' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

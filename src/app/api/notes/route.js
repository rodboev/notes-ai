import { NextResponse } from 'next/server'
import { firestore } from '../../../firebase' // Adjust the path to your firebase.js
import hash from 'object-hash'
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
  query,
  where,
  orderBy,
} from 'firebase/firestore'

// Helper function to delete existing collections
async function deletePreviousData() {
  try {
    const deleteCollection = async (collectionName) => {
      const collectionRef = collection(firestore, collectionName)
      const querySnapshot = await getDocs(collectionRef)

      const batch = writeBatch(firestore)
      querySnapshot.forEach((doc) => batch.delete(doc.ref))
      await batch.commit()
      console.log(
        `All documents from ${collectionName} collection successfully deleted`,
      )
    }

    // Delete documents from both 'notes' and 'emails' collections
    await deleteCollection('notes')
    await deleteCollection('emails')
  } catch (error) {
    console.warn(`Error deleting documents from Firestore: ${error.message}`)
  }
}

// GET Handler
export async function GET() {
  try {
    // Fetch documents with code '911 EMER' in the 'notes' collection
    const notesCollection = collection(firestore, 'notes')
    const q = query(
      notesCollection,
      where('code', '==', '911 EMER'),
      orderBy('date'),
      orderBy('time'),
    )
    const querySnapshot = await getDocs(q)
    const notes = querySnapshot.docs.map((doc) => doc.data())

    return NextResponse.json(notes)
  } catch (error) {
    console.error(`Error fetching notes from Firestore: ${error.message}`)
    // Return empty array, client-side will use local storage
    return NextResponse.json([])
  }
}

// DELETE Handler
export async function DELETE() {
  try {
    await deletePreviousData()
    return new NextResponse(null, { status: 204 }) // 204 No Content
  } catch (error) {
    console.warn(`Error deleting documents from Firestore: ${error.message}`)
    return new NextResponse(null, {
      status: 500,
      statusText: 'Internal Server Error',
    })
  }
}

// PUT Handler
export async function PUT(req) {
  let notes
  try {
    notes = await req.json()
  } catch (error) {
    console.warn('Invalid JSON:', error)
    return new Response(`Invalid JSON: ${error}`, { status: 400 })
  }

  const requiredKeys = [
    'Note Code',
    'Company',
    'Location Code',
    'Location ID',
    'Address Line 1',
    'Note',
    'Added By',
    'Note Date',
    'Note Time',
  ]

  const notesWithUndefinedValues = []

  // Ensure all fields are present and have valid values
  notes = notes.map((note) => {
    // Collect notes with undefined values
    let hasUndefinedValue = false
    requiredKeys.forEach((key) => {
      if (note[key] === undefined) {
        hasUndefinedValue = true
      }
    })

    if (hasUndefinedValue) {
      notesWithUndefinedValues.push(note)
    }

    return {
      fingerprint: hash(note),
      code: note['Note Code'] ?? '',
      company: note['Company'] ?? '',
      locationCode: note['Location Code'] ?? '',
      locationID: note['Location ID'] ?? '',
      address: note['Address Line 1'] ?? '',
      content: note['Note'] ?? '',
      tech: note['Added By'] ?? '',
      date: note['Note Date'] ?? '',
      time: note['Note Time'] ?? '',
    }
  })

  // Log notes with undefined values
  if (notesWithUndefinedValues.length > 0) {
    console.warn('Notes with undefined values:', notesWithUndefinedValues)
  }

  try {
    // Delete existing notes and emails before uploading new ones
    await deletePreviousData()

    // Batch write notes to Firestore
    const batch = writeBatch(firestore)
    notes.forEach((note) => {
      const docRef = doc(firestore, 'notes', note.fingerprint)
      batch.set(docRef, note)
    })
    await batch.commit()

    console.log('Notes successfully updated in Firestore')
    return new Response(JSON.stringify(notes), {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.warn(`Error writing to Firestore: ${error.message}`)
    return new Response(`Error writing to Firestore: ${error.message}`, {
      status: 500,
    })
  }
}

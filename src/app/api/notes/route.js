// src/app/api/notes/route.js

import { NextResponse } from 'next/server'
import hash from 'object-hash'
import {
  readFromDisk,
  writeToDisk,
  deleteFromDisk,
} from '../../utils/diskStorage'
import { firestore } from '../../../firebase'
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

async function deletePreviousData() {
  try {
    const deleteCollection = async (collectionName) => {
      const collectionRef = collection(firestore, collectionName)
      const querySnapshot = await getDocs(collectionRef)

      const batch = writeBatch(firestore)
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref)
      })
      await batch.commit()
      console.log(`Deleted ${collectionName} from Firestore`)
    }

    // Delete notes and emails
    await deleteCollection('notes')
    await deleteCollection('emails')
  } catch (error) {
    console.warn(`Error deleting documents from Firestore: ${error.message}`)
  }
}

export async function GET() {
  try {
    let notes = await readFromDisk('notes.json')
    if (!notes) {
      // If not on disk, fetch from Firestore
      const notesCollection = collection(firestore, 'notes')
      const querySnapshot = await getDocs(notesCollection)
      notes = querySnapshot.docs.map((doc) => doc.data())

      // Write to disk for future use
      await writeToDisk('notes.json', notes)
    }

    // Filter and sort notes
    const filteredNotes = notes
      .filter((note) => note.code === '911 EMER')
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.time.localeCompare(b.time)
      })

    return NextResponse.json(filteredNotes)
  } catch (error) {
    console.error(`Error fetching notes:`, error)
    return NextResponse.json([])
  }
}
export async function DELETE() {
  try {
    // Delete files from disk
    await deleteFromDisk('notes.json')
    await deleteFromDisk('emails.json')

    // Delete data from Firestore
    await deletePreviousData()

    return new NextResponse(null, { status: 204 }) // 204 No Content
  } catch (error) {
    console.warn(`Error deleting data:`, error)
    return new NextResponse(null, {
      status: 500,
      statusText: 'Internal Server Error',
    })
  }
}

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
    await writeToDisk('notes.json', [])
    await writeToDisk('emails.json', [])
    await deletePreviousData() // Keep Firestore deletion

    // Write all notes to disk
    await writeToDisk('notes.json', notes)

    // Batch write all notes to Firestore
    const batch = writeBatch(firestore)
    notes.forEach((note) => {
      const docRef = doc(firestore, 'notes', note.fingerprint)
      batch.set(docRef, note)
    })
    await batch.commit()

    console.log('Notes successfully updated in disk and Firestore')
    return new Response(JSON.stringify(notes), {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.warn(`Error writing data:`, error)
    return new Response(`Error writing data: ${error.message}`, {
      status: 500,
    })
  }
}

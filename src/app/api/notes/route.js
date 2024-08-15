// src/app/api/notes/route.js

import { NextResponse } from 'next/server'
import sql from 'mssql/msnodesqlv8.js'
import hash from 'object-hash'
import { readFromDisk, writeToDisk } from '../../utils/diskStorage'
import { firestore } from '../../../firebase'
import { collection, getDoc, getDocs, doc, writeBatch } from 'firebase/firestore'

sql.driver = 'FreeTDS'

const DESIRED_NOTE_CODES = ['911 EMER', 'SERVICE', 'KEY ISSUE', 'ALERT', 'HHALERT']
const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === 'production'

function formatDate(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    console.warn(`Invalid date string: ${dateString}`)
    return null
  }
  const date = new Date(dateString)
  return date.toISOString().split('T')[0]
}

const config = {
  server: process.env.SQL_SERVER || '127.0.0.1',
  port: parseInt(process.env.SQL_PORT) || 1433,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USERNAME,
  password: process.env.SQL_PASSWORD,
  options: {
    trustedConnection: false,
    enableArithAbort: true,
    encrypt: false,
    driver: 'FreeTDS',
  },
  connectionString: `Driver={FreeTDS};Server=${process.env.SQL_SERVER || '127.0.0.1'},${process.env.SQL_PORT || 1433};Database=${process.env.SQL_DATABASE};Uid=${process.env.SQL_USERNAME};Pwd=${process.env.SQL_PASSWORD};TDS_Version=7.4;`,
}

async function runQuery(pool, query) {
  try {
    // console.log(`Executing query: ${query}`)
    const result = await pool.request().query(query)
    console.log('Query successful')
    return result.recordset
  } catch (err) {
    console.error(`Error executing query "${query}":`, err)
    throw err
  }
}

async function getJoinedNotes(pool, startDate, endDate, limit = 500) {
  const formattedStartDate = formatDate(startDate)
  const formattedEndDate = formatDate(endDate)
  const noteCodesString = DESIRED_NOTE_CODES.map((code) => `'${code}'`).join(', ')

  const query = `
    SELECT TOP ${limit}
      n.LocationID,
      n.NoteDate,
      n.NoteCode,
      n.Note,
      CASE
        WHEN LEN(LTRIM(RTRIM(t.LName))) > 0
        THEN CONCAT(t.FName, ' ', LEFT(t.LName, 1), '.')
        ELSE t.FName
      END AS Tech,
      LTRIM(RTRIM(CONCAT(
        COALESCE(l.Address, ''), ', ',
        COALESCE(l.City, ''), ', ',
        COALESCE(l.State, ''), ' ',
        COALESCE(l.Zip, '')
      ))) AS Address,
      l.Company,
      l.LocationCode
    FROM Notes n
    LEFT JOIN Locations l ON n.LocationID = l.LocationID
    LEFT JOIN Employees e ON n.AddUserID = e.UserID
    LEFT JOIN Technicians t ON e.TechID = t.TechID
    WHERE n.NoteDate >= '${formattedStartDate}' 
      AND n.NoteDate < '${formattedEndDate}'
      AND n.NoteCode IN (${noteCodesString})
    ORDER BY n.NoteDate ASC
  `

  return await runQuery(pool, query)
}

async function getNotesCount(pool, startDate, endDate) {
  const formattedStartDate = formatDate(startDate)
  const formattedEndDate = formatDate(endDate)
  const noteCodesString = DESIRED_NOTE_CODES.map((code) => `'${code}'`).join(', ')

  const query = `
    SELECT COUNT(*) as count
    FROM Notes
    WHERE NoteDate >= '${formattedStartDate}' 
      AND NoteDate < '${formattedEndDate}'
      AND NoteCode IN (${noteCodesString})
  `

  const result = await runQuery(pool, query)
  return result[0].count
}

function transformNotes(notes) {
  return notes.map((note) => ({
    locationID: note.LocationID,
    date: note.NoteDate,
    code: note.NoteCode,
    content: note.Note,
    tech: note.Tech,
    address: note.Address,
    company: note.Company,
    locationCode: note.LocationCode,
  }))
}

async function updateNotesCacheIndex(cacheKey) {
  const index = (await readFromDisk('notesCacheIndex.json')) || {}
  index[cacheKey] = new Date().toISOString()
  await writeToDisk('notesCacheIndex.json', index)
}

async function saveNotes(notes, startDate, endDate) {
  const cacheKey = `notes_${startDate}_${endDate}`
  const cacheData = {
    notes,
    startDate,
    endDate,
    timestamp: new Date().toISOString(),
  }

  // Store in disk
  await writeToDisk(`${cacheKey}.json`, cacheData)

  // Store in Firestore
  const batch = writeBatch(firestore)
  const cacheDocRef = doc(firestore, 'notesCache', cacheKey)
  batch.set(cacheDocRef, {
    startDate,
    endDate,
    timestamp: new Date().toISOString(),
  })

  notes.forEach((note) => {
    const noteDocRef = doc(firestore, 'notesCache', cacheKey, 'notes', note.fingerprint)
    batch.set(noteDocRef, note)
  })
  await batch.commit()

  await updateNotesCacheIndex(cacheKey)

  console.log('Notes successfully stored in disk and Firestore')
}

async function getSavedNotes(cacheKey) {
  // Try to read from disk first
  const diskData = await readFromDisk(`${cacheKey}.json`)
  if (diskData) {
    console.log('Notes found in disk cache')
    return diskData.notes
  }

  // If not in disk, check Firestore
  const cacheDocRef = doc(firestore, 'notesCache', cacheKey)
  const cacheDocSnap = await getDoc(cacheDocRef)

  if (cacheDocSnap.exists()) {
    const notesCollectionRef = collection(firestore, 'notesCache', cacheKey, 'notes')
    const notesSnapshot = await getDocs(notesCollectionRef)
    const firestoreNotes = notesSnapshot.docs.map((doc) => doc.data())

    console.log('Notes found in Firestore')
    return firestoreNotes
  }

  return null
}

async function getNoteByFingerprint(fingerprint) {
  // Search in disk cache first
  const diskCaches = (await readFromDisk('notesCacheIndex.json')) || {}
  for (const cacheKey of Object.keys(diskCaches)) {
    const diskData = await readFromDisk(`${cacheKey}.json`)
    if (diskData && diskData.notes) {
      const foundNote = diskData.notes.find((note) => note.fingerprint === fingerprint)
      if (foundNote) {
        console.log('Note found in disk cache')
        return foundNote
      }
    }
  }

  // If not found in disk cache, search in Firestore
  const cacheSnapshots = await getDocs(collection(firestore, 'notesCache'))
  for (const cacheDoc of cacheSnapshots.docs) {
    const notesCollectionRef = collection(firestore, 'notesCache', cacheDoc.id, 'notes')
    const noteDoc = await getDoc(doc(notesCollectionRef, fingerprint))
    if (noteDoc.exists()) {
      console.log('Note found in Firestore')
      return noteDoc.data()
    }
  }

  console.log('Note not found in cache or Firestore')
  return null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  let startDate = searchParams.get('startDate')
  let endDate = searchParams.get('endDate')
  let fingerprint = searchParams.get('fingerprint')

  if (fingerprint) {
    const note = await getNoteByFingerprint(fingerprint)
    if (note) {
      return NextResponse.json([note])
    } else {
      return NextResponse.json(
        {
          error: 'Note not found',
        },
        { status: 404 },
      )
    }
  }

  // If startDate or endDate is null, undefined, or "null", set default values
  if (!startDate || startDate === 'null' || !endDate || endDate === 'null') {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    startDate =
      startDate && startDate !== 'null' ? startDate : yesterday.toISOString().split('T')[0]
    endDate = endDate && endDate !== 'null' ? endDate : today.toISOString().split('T')[0]
    console.log(`Using default dates: startDate=${startDate}, endDate=${endDate}`)
  }

  // Adjust endDate for database query
  const queryEndDate = new Date(endDate)
  queryEndDate.setDate(queryEndDate.getDate() + 1)
  const formattedQueryEndDate = queryEndDate.toISOString().split('T')[0]

  // Try to get stored notes first
  const cacheKey = `notes_${startDate}_${endDate}`
  let storedNotes = await getSavedNotes(cacheKey)
  if (storedNotes) {
    console.log(`Returning ${storedNotes.length} notes`)
    return NextResponse.json(storedNotes)
  }

  let pool
  try {
    console.log('Attempting to connect to the database...')
    pool = await sql.connect(config)
    console.log('Connected successfully')

    let notes = await getJoinedNotes(pool, startDate, formattedQueryEndDate)

    notes = transformNotes(notes)
      .filter((note) => note.code === '911 EMER')
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // Add fingerprint to each note
    notes = notes.map((note) => ({
      ...note,
      fingerprint: hash(note),
    }))

    // Store the notes in disk and Firestore
    await saveNotes(notes, startDate, endDate)

    console.log(`Returning ${notes.length} notes`)
    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error.message,
      },
      {
        status: 500,
      },
    )
  } finally {
    if (pool) {
      try {
        await pool.close()
        console.log('Connection closed')
      } catch (closeErr) {
        console.error('Error closing connection:', closeErr)
      }
    }
  }
}

// src/app/api/notes/route.js

import { NextResponse } from 'next/server'
import sql from 'mssql/msnodesqlv8.js'
import hash from 'object-hash'
import { readFromDisk, writeToDisk } from '../../utils/diskStorage'
import { firestore } from '../../../firebase'
import { collection, doc } from 'firebase/firestore'
import { firestoreGetDoc, firestoreBatchWrite, firestoreSetDoc } from '../../utils/firestoreHelper'
import { timestamp } from '../../utils/timestamp'

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
      l.LocationCode,
      l.EMail
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
    emailAddress: note.EMail,
  }))
}

async function loadNotes() {
  console.log(`${timestamp()} Attempting to load notes from disk`)
  const diskNotes = await readFromDisk('notes.json')
  if (diskNotes && diskNotes.length > 0) {
    console.log(`${timestamp()} Loaded ${diskNotes.length} notes from disk`)
    return diskNotes
  }

  console.log(`${timestamp()} Notes not on disk or empty, loading from Firestore`)
  const notesCollection = collection(firestore, 'notes')
  const snapshot = await getDocs(notesCollection)
  const notes = snapshot.docs.map((doc) => doc.data())
  console.log(`${timestamp()} Loaded ${notes.length} notes from Firestore`)

  if (notes.length > 0) {
    await writeToDisk('notes.json', notes)
    console.log(`${timestamp()} Saved ${notes.length} notes to disk`)
  }

  return notes
}

async function saveNotes(notes) {
  console.warn(`${timestamp()} Saving notes to disk and Firestore`)

  const diskNotes = await readFromDisk('notes.json')
  const hasChanges = !diskNotes || JSON.stringify(diskNotes) !== JSON.stringify(notes)

  if (hasChanges) {
    await writeToDisk('notes.json', notes)
    console.log(`${timestamp()} Saved ${notes.length} notes to disk`)

    console.log(`${timestamp()} Saving notes to Firestore`)
    const operations = notes.map((note) => ({
      type: 'set',
      ref: doc(firestore, 'notes', note.fingerprint),
      data: note,
    }))
    await firestoreBatchWrite(operations)

    console.log(`${timestamp()} Saved ${notes.length} notes to Firestore`)
  } else {
    console.log(`${timestamp()} No changes detected, skipping save operation`)
  }
}

async function getNotesByFingerprints(fingerprints) {
  console.log(`Searching for fingerprints: ${fingerprints}`)

  if (!Array.isArray(fingerprints)) {
    fingerprints = [fingerprints]
  }

  let allNotes = await loadNotes()
  let foundNotes = allNotes.filter((note) => fingerprints.includes(note.fingerprint))

  // If not all notes were found in the cache, fetch the missing ones from Firestore
  if (foundNotes.length < fingerprints.length) {
    const missingFingerprints = fingerprints.filter(
      (fp) => !foundNotes.some((note) => note.fingerprint === fp),
    )
    console.log(`Fetching ${missingFingerprints.length} missing notes from Firestore`)

    for (const fp of missingFingerprints) {
      const noteDoc = await firestoreGetDoc('notes', fp)
      if (noteDoc) {
        foundNotes.push(noteDoc)
        // Add to local cache
        allNotes.push(noteDoc)
      }
    }

    // Update local cache if new notes were found
    if (foundNotes.length > allNotes.length) {
      await writeToDisk('notes.json', allNotes)
    }
  }

  console.log(`${timestamp()} ${foundNotes.length} out of ${fingerprints.length} notes found`)
  return foundNotes
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  let startDate = searchParams.get('startDate')
  let endDate = searchParams.get('endDate')
  let fingerprint = searchParams.get('fingerprint')
  let fingerprints = searchParams.get('fingerprints')

  if (fingerprint || fingerprints) {
    const fingerprintsToFetch = fingerprints ? fingerprints.split(',') : [fingerprint]
    const notes = await getNotesByFingerprints(fingerprintsToFetch)
    if (notes.length > 0) {
      return NextResponse.json(notes)
    } else {
      return NextResponse.json(
        {
          error: 'Notes not found',
        },
        { status: 404 },
      )
    }
  }

  // Set default dates if not provided
  if (!startDate || startDate === 'null' || !endDate || endDate === 'null') {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    startDate =
      startDate && startDate !== 'null' ? startDate : yesterday.toISOString().split('T')[0]
    endDate = endDate && endDate !== 'null' ? endDate : today.toISOString().split('T')[0]
    console.log(`Using default dates: startDate=${startDate}, endDate=${endDate}`)
  }

  // Try to get stored notes first
  let notes = await loadNotes()
  notes = notes.filter(
    (note) => note.date >= startDate && note.date < endDate && note.code === '911 EMER',
  )

  if (notes.length > 0) {
    console.log(`Returning ${notes.length} notes from cache`)
    return NextResponse.json(notes)
  }

  // If not in cache, try to fetch from database
  let pool
  try {
    console.log('Attempting to connect to the database...')
    pool = await sql.connect(config)
    console.log('Connected successfully')

    const queryEndDate = new Date(endDate)
    queryEndDate.setDate(queryEndDate.getDate() + 1)
    const formattedQueryEndDate = queryEndDate.toISOString().split('T')[0]

    notes = await getJoinedNotes(pool, startDate, formattedQueryEndDate)

    notes = transformNotes(notes)
      .filter((note) => note.code === '911 EMER')
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // Add fingerprint to each note
    notes = notes.map((note) => ({
      ...note,
      fingerprint: hash(note),
    }))

    // Store the notes in disk and Firestore
    await saveNotes(notes)

    console.log(`Returning ${notes.length} notes from database`)
    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching from database:', error)

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

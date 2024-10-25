// src/app/api/notes/route.js

import { NextResponse } from 'next/server'
// import sql from 'mssql/msnodesqlv8.js
import sql from 'mssql'
import hash from 'object-hash'
import { readFromDisk, writeToDisk } from '../../utils/diskStorage'
import { firestore } from '../../../firebase'
import { doc } from 'firebase/firestore'
import {
  firestoreBatchGet,
  firestoreBatchWrite,
  firestoreGetAllDocs,
  queueWrite,
} from '../../utils/firestoreHelper'
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
  port: Number.parseInt(process.env.SQL_PORT) || 1433,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USERNAME,
  password: process.env.SQL_PASSWORD,
  options: {
    trustedConnection: false,
    enableArithAbort: true,
    encrypt: true, // Changed to true to enable encryption
    trustServerCertificate: true, // Added to bypass certificate validation
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
      Notes.LocationID,
      Notes.NoteDate,
      Notes.NoteCode,
      Notes.Note,
      CASE
        WHEN LEN(LTRIM(RTRIM(Technicians.LName))) > 0
        THEN CONCAT(Technicians.FName, ' ', LEFT(Technicians.LName, 1), '.')
        ELSE Technicians.FName
      END AS Tech,
      LTRIM(RTRIM(CONCAT(
        COALESCE(Locations.Address, ''), ', ',
        COALESCE(Locations.City, ''), ', ',
        COALESCE(Locations.State, ''), ' ',
        COALESCE(Locations.Zip, '')
      ))) AS Address,
      Locations.Company,
      Locations.LocationCode,
      Locations.EMail,
      COALESCE(AnnualOccurrences.TotalAnnualOccurrences, 1) AS TotalAnnualOccurrences
    FROM Notes
    LEFT JOIN Locations ON Notes.LocationID = Locations.LocationID
    LEFT JOIN Employees ON Notes.AddUserID = Employees.UserID
    LEFT JOIN Technicians ON Employees.TechID = Technicians.TechID
    OUTER APPLY (
      SELECT 
        SUM(FrequencyClasses.AnnualOccurrences) AS TotalAnnualOccurrences
      FROM ServiceSetups
      LEFT JOIN Schedules ON ServiceSetups.ScheduleID = Schedules.ScheduleID
      LEFT JOIN FrequencyClasses ON Schedules.FrequencyID = FrequencyClasses.FrequencyID
      WHERE ServiceSetups.LocationID = Notes.LocationID
        AND ServiceSetups.Active = 1
    ) AS AnnualOccurrences
    WHERE Notes.NoteDate >= '${formattedStartDate}' 
      AND Notes.NoteDate < '${formattedEndDate}'
      AND Notes.NoteCode IN (${noteCodesString})
    ORDER BY Notes.NoteDate ASC
  `

  return await runQuery(pool, query)
}

function transformNotes(notes) {
  return notes.map((note) => {
    const transformedNote = {
      locationID: note.LocationID,
      date: note.NoteDate,
      code: note.NoteCode,
      content: note.Note,
      tech: note.Tech,
      address: note.Address,
      company: note.Company,
      locationCode: note.LocationCode,
      annualOccurrences: note.TotalAnnualOccurrences,
    }

    if (note.EMail && note.EMail.trim() !== '') {
      transformedNote.emailAddress = note.EMail
    }

    return transformedNote
  })
}

async function loadNotes() {
  console.log(`${timestamp()} Attempting to load notes from disk`)
  const diskNotes = await readFromDisk('notes.json')
  if (diskNotes && diskNotes.length > 0) {
    console.log(`${timestamp()} Loaded ${diskNotes.length} notes from disk`)
    return diskNotes
  }

  console.log(`${timestamp()} Notes not on disk or empty, loading from Firestore`)
  const notes = await firestoreGetAllDocs('notes')
  console.log(`${timestamp()} Loaded ${notes.length} notes from Firestore`)

  if (notes.length > 0) {
    await writeToDisk('notes.json', notes)
    console.log(`${timestamp()} Saved ${notes.length} notes to disk`)
  }

  return notes
}

async function saveNotes(notes) {
  console.warn(`${timestamp()} Saving notes to disk and queueing for Firestore`)

  const diskNotes = await readFromDisk('notes.json')
  const newNotes = notes.filter(
    (note) => !diskNotes.some((diskNote) => diskNote.fingerprint === note.fingerprint),
  )

  if (newNotes.length > 0) {
    await writeToDisk('notes.json', [...diskNotes, ...newNotes])
    console.log(`${timestamp()} Saved ${newNotes.length} new notes to disk`)

    console.log(`${timestamp()} Queueing ${newNotes.length} notes for Firestore write`)
    queueWrite('notes', newNotes)
  } else {
    console.log(`${timestamp()} No new notes to save`)
  }
}

async function getNotesByFingerprints(fingerprints) {
  // Ensure fingerprints is always an array
  const fingerprintArray = Array.isArray(fingerprints) ? fingerprints : [fingerprints]

  let allNotes = await loadNotes()
  let foundNotes = allNotes.filter((note) => fingerprintArray.includes(note.fingerprint))

  // If not all notes were found in the cache, fetch the missing ones from Firestore
  if (foundNotes.length < fingerprintArray.length) {
    const missingFingerprints = fingerprintArray.filter(
      (fp) => !foundNotes.some((note) => note.fingerprint === fp),
    )
    console.log(`Fetching ${missingFingerprints.length} missing notes from Firestore`)

    const missingNotes = await firestoreBatchGet('notes', missingFingerprints)
    foundNotes = [...foundNotes, ...missingNotes.filter(Boolean)]

    // Update local cache if new notes were found
    if (missingNotes.some(Boolean)) {
      allNotes = [...allNotes, ...missingNotes.filter(Boolean)]
      await writeToDisk('notes.json', allNotes)
    }
  }

  console.log(`${timestamp()} ${foundNotes.length} out of ${fingerprintArray.length} notes found`)
  return foundNotes
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  let startDate = searchParams.get('startDate')
  let endDate = searchParams.get('endDate')
  const fingerprint = searchParams.get('fingerprint')
  const fingerprints = searchParams.get('fingerprints')

  if (fingerprint || fingerprints) {
    const fingerprintsToFetch = fingerprints ? fingerprints.split(',') : [fingerprint]
    const notes = await getNotesByFingerprints(fingerprintsToFetch)
    if (notes.length === 0) return NextResponse.json([])
    return NextResponse.json(notes)
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

  console.log(`Fetching notes for date range: ${startDate} to ${endDate}`)

  // Ensure endDate is exclusive
  const queryEndDate = new Date(endDate)
  queryEndDate.setDate(queryEndDate.getDate() + 1)
  const formattedQueryEndDate = queryEndDate.toISOString().split('T')[0]

  // Try to get stored notes first
  const allNotes = await loadNotes()
  const notes = allNotes.filter(
    (note) =>
      note.date >= startDate && note.date < formattedQueryEndDate && note.code === '911 EMER',
  )

  if (notes.length > 0) {
    console.log(`Returning ${notes.length} notes from cache`)
    return NextResponse.json(notes)
  }

  // If not in cache, fetch from database
  let pool
  try {
    console.log('Fetching notes from database...')
    pool = await sql.connect(config)

    const fetchedNotes = await getJoinedNotes(pool, startDate, formattedQueryEndDate)

    const transformedNotes = transformNotes(fetchedNotes)
      .filter((note) => note.code === '911 EMER')
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // Add fingerprint to each note
    const notesWithFingerprints = transformedNotes.map((note) => ({
      ...note,
      fingerprint: hash(note),
    }))

    // Update the cache with new notes
    await saveNotes(notesWithFingerprints)

    console.log(`Returning ${notesWithFingerprints.length} notes from database`)
    return NextResponse.json(notesWithFingerprints)
  } catch (error) {
    console.error('Error fetching from database:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 },
    )
  } finally {
    if (pool) {
      try {
        await pool.close()
        console.log('Database connection closed')
      } catch (closeErr) {
        console.error('Error closing database connection:', closeErr)
      }
    }
  }
}

async function fetchNotesFromDatabase(startDate, endDate) {
  try {
    console.log('Attempting to connect to the database...')
    await sql.connect({
      server: '127.0.0.1',
      port: 1433,
      user: process.env.SQL_USERNAME,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DATABASE,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    })
    console.log('Successfully connected to the database')

    // ... (rest of the function)
  } catch (error) {
    console.error('Detailed database connection error:', error)
    console.error('SQL connection config:', {
      server: '127.0.0.1',
      port: 1433,
      user: process.env.SQL_USERNAME,
      password: '******', // Don't log the actual password
      database: process.env.SQL_DATABASE,
    })
    console.error('Error stack:', error.stack)
    throw error
  }
}

import sql from 'mssql/msnodesqlv8.js'
import hash from 'object-hash'
import { readFromDisk, writeToDisk } from '@/utils/diskStorage'
import {
  firestoreBatchGet,
  firestoreBatchWrite,
  firestoreGetAllDocs,
} from '@/utils/firestoreHelper'
import { timestamp } from '@/utils/timestamp'

sql.driver = 'FreeTDS'

const DESIRED_NOTE_CODES = ['911 EMER', 'SERVICE', 'KEY ISSUE', 'ALERT', 'HHALERT']
const isProduction = process.env.NODE_ENV === 'production'

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
  console.warn(`${timestamp()} Saving notes to disk and Firestore`)

  const diskNotes = await readFromDisk('notes.json')
  const hasChanges = !diskNotes || JSON.stringify(diskNotes) !== JSON.stringify(notes)

  if (hasChanges) {
    await writeToDisk('notes.json', notes)
    console.log(`${timestamp()} Saved ${notes.length} notes to disk`)

    console.log(`${timestamp()} Saving notes to Firestore`)
    const { validOperations, skippedOperations, error } = await firestoreBatchWrite('notes', notes)

    if (error) {
      console.error('Error during batch write:', error)
    } else {
      console.log(
        `${timestamp()} Saved ${validOperations} notes to Firestore, skipped ${skippedOperations}`,
      )
    }
  } else {
    console.log(`${timestamp()} No changes detected, skipping save operation`)
  }
}

async function getNotesByFingerprints(fingerprints) {
  console.log(`Searching for fingerprints: ${fingerprints}`)
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

export async function getNotes({ query }) {
  const searchParams = new URLSearchParams(query)
  let startDate = searchParams.get('startDate')
  let endDate = searchParams.get('endDate')
  const fingerprint = searchParams.get('fingerprint')
  const fingerprints = searchParams.get('fingerprints')

  if (fingerprint || fingerprints) {
    const fingerprintsToFetch = fingerprints ? fingerprints.split(',') : [fingerprint]
    const notes = await getNotesByFingerprints(fingerprintsToFetch)
    if (notes.length === 0)
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      })
    return new Response(JSON.stringify(notes), {
      headers: { 'Content-Type': 'application/json' },
    })
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
  let allNotes = await loadNotes()
  let notes = allNotes.filter(
    (note) =>
      note.date >= startDate && note.date < formattedQueryEndDate && note.code === '911 EMER',
  )

  if (notes.length > 0) {
    console.log(`Returning ${notes.length} notes from cache`)
    return new Response(JSON.stringify(notes), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // If not in cache, fetch from database
  let pool
  try {
    console.log('Fetching notes from database...')
    pool = await sql.connect(config)

    notes = await getJoinedNotes(pool, startDate, formattedQueryEndDate)

    notes = transformNotes(notes)
      .filter((note) => note.code === '911 EMER')
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // Add fingerprint to each note
    notes = notes.map((note) => ({
      ...note,
      fingerprint: hash(note),
    }))

    // Update the cache with new notes
    allNotes = [...allNotes, ...notes]
    await saveNotes(allNotes)

    console.log(`Returning ${notes.length} notes from database`)
    return new Response(JSON.stringify(notes), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching from database:', error)
    return new Response(JSON.stringify({ error: `Internal Server Error: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
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

export default {
  getNotes,
}

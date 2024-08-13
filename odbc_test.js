const odbc = require('odbc')
require('dotenv').config()

function getConnectionString() {
  const isHeroku = process.env.DYNO ? true : false
  const driver = isHeroku ? '{FreeTDS}' : '{ODBC Driver 18 for SQL Server}'
  return `Driver=${driver};Server=${process.env.SQL_SERVER || '127.0.0.1'},${process.env.SQL_PORT || 1433};Database=${process.env.SQL_DATABASE};UID=${process.env.SQL_USERNAME};PWD=${process.env.SQL_PASSWORD};Encrypt=yes;TrustServerCertificate=yes;`
}

const connectionString = getConnectionString()
console.log(`Connection String: ${connectionString.replace(/PWD=[^;]+/, 'PWD=*****')}`)

async function runQuery(connection, query) {
  try {
    console.log(`Executing query: ${query}`)
    const result = await connection.query(query)
    console.log('Query successful')
    return result
  } catch (err) {
    console.error(`Error executing query "${query}":`, err)
    if (err.odbcErrors) {
      console.error('ODBC Errors:', JSON.stringify(err.odbcErrors, null, 2))
    }
    return null
  }
}

async function getNotesInDateRange(connection, startDate, endDate, limit = 100) {
  // Get all column names except 'Note'
  const columnsResult = await runQuery(
    connection,
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Notes' AND COLUMN_NAME != 'Note'",
  )
  const columnNames = columnsResult.map((col) => col.COLUMN_NAME).join(', ')

  // Query all columns except 'Note' within the date range
  const mainResult = await runQuery(
    connection,
    `SELECT TOP ${limit} ${columnNames}
     FROM Notes
     WHERE NoteDate >= '${startDate}' AND NoteDate < '${endDate}'
     ORDER BY NoteDate ASC`,
  )

  if (!mainResult) return null

  // Query 'Note' column separately for the same records
  const noteIds = mainResult.map((row) => row.NoteID).join(',')
  const noteResult = await runQuery(
    connection,
    `SELECT NoteID, Note
     FROM Notes
     WHERE NoteID IN (${noteIds})`,
  )

  // Combine the results
  if (mainResult && noteResult) {
    return mainResult.map((row) => {
      const noteRow = noteResult.find((nr) => nr.NoteID === row.NoteID)
      return { ...row, Note: noteRow ? noteRow.Note : null }
    })
  }
  return null
}

async function main() {
  let connection
  try {
    console.log('Attempting to connect to the database...')
    connection = await odbc.connect(connectionString)
    console.log('Connected successfully')

    // Get notes from 8/13 to 8/14
    const startDate = '2023-08-13'
    const endDate = '2023-08-14' // Use the day after your end date to include all of 8/13
    console.log(`Retrieving notes from ${startDate} to ${endDate}:`)
    const notes = await getNotesInDateRange(connection, startDate, endDate)

    if (notes && notes.length > 0) {
      console.log(`Retrieved ${notes.length} notes:`)
      console.log(JSON.stringify(notes[0], null, 2)) // Print the first note as an example

      // Example of working with the data
      notes.forEach((note) => {
        console.log(
          `Note ID: ${note.NoteID}, Date: ${note.NoteDate}, Content: ${note.Note.substring(0, 50)}...`,
        )
      })
    } else {
      console.log('No notes found or failed to retrieve notes')
    }

    // Example of a simple query
    console.log('Executing a simple query:')
    const versionResult = await runQuery(connection, 'SELECT @@VERSION AS SqlVersion')
    console.log('SQL Server Version:', versionResult[0].SqlVersion)
  } catch (err) {
    console.error('Error:', err)
  } finally {
    if (connection) {
      try {
        await connection.close()
        console.log('Connection closed')
      } catch (closeErr) {
        console.error('Error closing connection:', closeErr)
      }
    }
  }
}

main().then(() => console.log('Script completed'))

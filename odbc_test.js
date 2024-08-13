const odbc = require('odbc')
require('dotenv').config()

function getConnectionString() {
  const isHeroku = process.env.DYNO ? true : false
  const driver = isHeroku ? '{FreeTDS}' : '{ODBC Driver 18 for SQL Server}'

  return `Driver=${driver};Server=${process.env.SQL_SERVER || '127.0.0.1'},${process.env.SQL_PORT || 1433};Database=${process.env.SQL_DATABASE};UID=${process.env.SQL_USERNAME};PWD=${process.env.SQL_PASSWORD};Encrypt=yes;TrustServerCertificate=yes;`
}

const connectionString = getConnectionString()

console.log(`Connection String: ${connectionString.replace(/PWD=[^;]+/, 'PWD=*****')}`)

async function runQuery(connection, query, params = []) {
  try {
    console.log(`Executing query: ${query}`)
    const result = await connection.query(query, params)
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

async function getNotes(connection, limit = 1) {
  // Get all column names except 'Note'
  const columnsResult = await runQuery(
    connection,
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Notes' AND COLUMN_NAME != 'Note'",
  )
  const columnNames = columnsResult.map((col) => col.COLUMN_NAME).join(', ')

  // Query all columns except 'Note'
  const mainResult = await runQuery(connection, `SELECT TOP ${limit} ${columnNames} FROM Notes`)

  // Query 'Note' column separately
  const noteResult = await runQuery(connection, `SELECT TOP ${limit} NoteID, Note FROM Notes`)

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

    // Get notes
    console.log('Retrieving notes:')
    const notes = await getNotes(connection, 1)

    if (notes) {
      console.log('Retrieved notes:')
      console.log(JSON.stringify(notes, null, 2))
    } else {
      console.log('Failed to retrieve notes')
    }

    // Test a simple query
    console.log('Executing a simple query:')
    await runQuery(connection, 'SELECT @@VERSION AS SqlVersion')
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

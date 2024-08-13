const Sequelize = require('sequelize')
const odbc = require('odbc')
require('dotenv').config()

function getConnectionString() {
  const isHeroku = process.env.DYNO ? true : false
  const driver = isHeroku ? '{FreeTDS}' : '{ODBC Driver 18 for SQL Server}'
  return `Driver=${driver};Server=${process.env.SQL_SERVER || '127.0.0.1'},${process.env.SQL_PORT || 1433};Database=${process.env.SQL_DATABASE};UID=${process.env.SQL_USERNAME};PWD=${process.env.SQL_PASSWORD};Encrypt=yes;TrustServerCertificate=yes;`
}

const connectionString = getConnectionString()
console.log(`Connection String: ${connectionString.replace(/PWD=[^;]+/, 'PWD=*****')}`)

// Create a Sequelize instance without an actual connection
const sequelize = new Sequelize('dummy', 'dummy', 'dummy', {
  dialect: 'mssql',
  logging: false,
})

// Define your model
const Note = sequelize.define(
  'Note',
  {
    NoteID: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    CompanyID: Sequelize.INTEGER,
    LocationID: Sequelize.INTEGER,
    NoteDate: Sequelize.DATE,
    NoteCode: Sequelize.STRING,
    Note: Sequelize.TEXT,
    // ... other fields
  },
  {
    tableName: 'Notes',
    timestamps: false,
  },
)

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

async function getNotesInDateRange(connection, startDate, endDate, limit = 100, offset = 0) {
  // Get all column names except 'Note'
  const columnsResult = await runQuery(
    connection,
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Notes' AND COLUMN_NAME != 'Note'",
  )
  const columnNames = columnsResult.map((col) => col.COLUMN_NAME).join(', ')

  // Query all columns except 'Note' within the date range
  const mainResult = await runQuery(
    connection,
    `
    SELECT ${columnNames}
    FROM (
      SELECT ROW_NUMBER() OVER (ORDER BY NoteDate ASC) AS RowNum, ${columnNames}
      FROM Notes
      WHERE NoteDate >= ? AND NoteDate < ?
    ) AS NumberedNotes
    WHERE RowNum > ? AND RowNum <= ?
  `,
    [startDate, endDate, offset, offset + limit],
  )

  // Get total count
  const countResult = await runQuery(
    connection,
    `
    SELECT COUNT(*) AS TotalCount
    FROM Notes
    WHERE NoteDate >= ? AND NoteDate < ?
  `,
    [startDate, endDate],
  )

  const totalCount = countResult[0].TotalCount

  // Query 'Note' column separately for the same records
  const noteIds = mainResult.map((row) => row.NoteID).join(',')
  const noteResult = await runQuery(
    connection,
    `
    SELECT NoteID, Note
    FROM Notes
    WHERE NoteID IN (${noteIds})
  `,
  )

  // Combine the results
  if (mainResult && noteResult) {
    const combinedResults = mainResult.map((row) => {
      const noteRow = noteResult.find((nr) => nr.NoteID === row.NoteID)
      return { ...row, Note: noteRow ? noteRow.Note : null }
    })

    return {
      count: totalCount,
      rows: combinedResults,
    }
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
    const endDate = '2023-08-14'
    console.log(`Retrieving notes from ${startDate} to ${endDate}:`)

    // Simulating findAndCountAll with pagination
    const limit = 10
    const page = 1
    const offset = (page - 1) * limit

    const result = await getNotesInDateRange(connection, startDate, endDate, limit, offset)

    if (result) {
      console.log(`Retrieved ${result.rows.length} notes out of ${result.count} total:`)
      console.log(JSON.stringify(result.rows, null, 2))

      // Create Sequelize model instances from the raw data
      const sequelizeNotes = result.rows.map((note) => Note.build(note, { isNewRecord: false }))
      console.log('Sequelize note objects:', sequelizeNotes)

      // Example of using Sequelize instance methods
      sequelizeNotes.forEach((note) => {
        console.log(
          `Note ID: ${note.NoteID}, Date: ${note.NoteDate}, Summary: ${note.Note.substring(0, 50)}...`,
        )
      })
    } else {
      console.log('Failed to retrieve notes')
    }
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

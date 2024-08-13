const Sequelize = require('sequelize')
const odbc = require('odbc')
require('dotenv').config()

function getConnectionString() {
  return `Driver={FreeTDS};Server=${process.env.SQL_SERVER || '127.0.0.1'};Port=${process.env.SQL_PORT || 1433};Database=${process.env.SQL_DATABASE};UID=${process.env.SQL_USERNAME};PWD=${process.env.SQL_PASSWORD};TDS_Version=7.4;`
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

async function getNotesInDateRange(connection, startDate, endDate, limit = 100, offset = 0) {
  // Ensure dates are in the correct format
  const formattedStartDate = new Date(startDate).toISOString().split('T')[0]
  const formattedEndDate = new Date(endDate).toISOString().split('T')[0]

  const query = `
    WITH CountedNotes AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY NoteDate ASC) AS RowNum
      FROM Notes
      WHERE NoteDate >= '${formattedStartDate}' AND NoteDate < '${formattedEndDate}'
    )
    SELECT *
    FROM (
      SELECT COUNT(*) AS TotalCount FROM CountedNotes
    ) AS CountTable
    CROSS APPLY (
      SELECT * FROM CountedNotes
      WHERE RowNum > ${offset} AND RowNum <= ${offset + limit}
    ) AS PagedNotes
  `

  const result = await runQuery(connection, query)

  if (result && result.length > 0) {
    const totalCount = result[0].TotalCount
    const rows = result.map((row) => {
      const { TotalCount, RowNum, ...noteData } = row
      return noteData
    })

    return {
      count: totalCount,
      rows: rows,
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

    const startDate = '2023-08-13'
    const endDate = '2023-08-14'
    console.log(`Retrieving notes from ${startDate} to ${endDate}:`)

    const limit = 10
    const page = 1
    const offset = (page - 1) * limit

    const result = await getNotesInDateRange(connection, startDate, endDate, limit, offset)

    if (result) {
      console.log(`Retrieved ${result.rows.length} notes out of ${result.count} total:`)
      console.log(JSON.stringify(result.rows[0], null, 2)) // Print the first note as an example

      // Create Sequelize model instances from the raw data
      const sequelizeNotes = result.rows.map((note) => Note.build(note, { isNewRecord: false }))

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

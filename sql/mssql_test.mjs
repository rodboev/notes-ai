import sql from 'mssql/msnodesqlv8.js'
sql.driver = 'FreeTDS'
import dotenv from 'dotenv'
import findConfig from 'find-config'

// Load .env file from the nearest parent directory
dotenv.config({ path: findConfig('.env') })
console.log(process.env.SQL_USERNAME)

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

console.log(
  `Connection config: ${JSON.stringify({ ...config, password: '*****', connectionString: config.connectionString.replace(/Pwd=[^;]+/, 'Pwd=*****') }, null, 2)}`,
)

async function runQuery(pool, query) {
  try {
    console.log(`Executing query: ${query}`)
    const result = await pool.request().query(query)
    console.log('Query successful')
    return result.recordset
  } catch (err) {
    console.error(`Error executing query "${query}":`, err)
    return null
  }
}

async function getNotesInDateRange(pool, startDate, endDate, limit = 100) {
  const formattedStartDate = new Date(startDate).toISOString().split('T')[0]
  const formattedEndDate = new Date(endDate).toISOString().split('T')[0]

  const query = `
    SELECT TOP ${limit} *
    FROM Notes
    WHERE NoteDate >= '${formattedStartDate}' AND NoteDate < '${formattedEndDate}'
    ORDER BY NoteDate ASC
  `

  return await runQuery(pool, query)
}

async function main() {
  let pool
  try {
    console.log('Attempting to connect to the database...')
    pool = await sql.connect(config)
    console.log('Connected successfully')

    const startDate = '2023-08-13'
    const endDate = '2023-08-14'
    console.log(`Retrieving notes from ${startDate} to ${endDate}:`)

    const notes = await getNotesInDateRange(pool, startDate, endDate)

    if (notes && notes.length > 0) {
      console.log(`Retrieved ${notes.length} notes:`)
      console.log(JSON.stringify(notes[0], null, 2))

      notes.forEach((note) => {
        console.log(
          `Note ID: ${note.NoteID}, Date: ${note.NoteDate}, Content: ${note.Note.substring(0, 50)}...`,
        )
      })
    } else {
      console.log('No notes found or failed to retrieve notes')
    }

    console.log('Executing a simple query:')
    const versionResult = await runQuery(pool, 'SELECT @@VERSION AS SqlVersion')
    console.log('SQL Server Version:', versionResult[0].SqlVersion)
  } catch (err) {
    console.error('Error:', err)
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

main().then(() => console.log('Script completed'))

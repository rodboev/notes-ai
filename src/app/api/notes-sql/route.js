// src/app/api/notes-sql/route.js

import { NextResponse } from 'next/server'
import sql from 'mssql/msnodesqlv8.js'

sql.driver = 'FreeTDS'

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
    console.log(`Executing query: ${query}`)
    const result = await pool.request().query(query)
    console.log('Query successful')
    return result.recordset
  } catch (err) {
    console.error(`Error executing query "${query}":`, err)
    throw err
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

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') || '2023-08-13'
  const endDate = searchParams.get('endDate') || '2023-08-14'
  const limit = parseInt(searchParams.get('limit') || '100')

  let pool
  try {
    console.log('Attempting to connect to the database...')
    pool = await sql.connect(config)
    console.log('Connected successfully')

    const notes = await getNotesInDateRange(pool, startDate, endDate, limit)
    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 },
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

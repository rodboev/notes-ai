require('dotenv').config()

const connectionString = `Driver={ODBC Driver 17 for SQL Server};Server=${process.env.SQL_SERVER || '127.0.0.1'},${process.env.SQL_PORT || 1433};Database=${process.env.SQL_DATABASE};UID=${process.env.SQL_USERNAME};PWD=${process.env.SQL_PASSWORD};Encrypt=yes;TrustServerCertificate=yes;`

const sql = require('mssql/msnodesqlv8')

console.log(`Connection String: ${connectionString}`)

const conf = {
  connectionString: connectionString,
  driver: 'msnodesqlv8',
}

;(async () => {
  try {
    console.log('Connecting to SQL Server...')
    const pool = await sql.connect(conf)
    console.log('Connected successfully to SQL Server.')

    const result = await pool.request().query('SELECT TOP 1 * FROM Notes')
    console.log('Query executed successfully.')
    console.dir(result)
  } catch (err) {
    console.error('SQL error: ', err)
  } finally {
    if (sql.connected) {
      await sql.close()
      console.log('Connection closed.')
    }
  }
})()

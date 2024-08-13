const odbc = require('odbc')

const connectionString = `Driver={ODBC Driver 17 for SQL Server};Server=${process.env.SQL_SERVER || '127.0.0.1'},${process.env.SQL_PORT || 1433};Database=${process.env.SQL_DATABASE};UID=${process.env.SQL_USERNAME};PWD=${process.env.SQL_PASSWORD};Encrypt=yes;TrustServerCertificate=yes;`

console.log(`Connection String: ${connectionString}`)

async function main() {
  try {
    // Connect to the database
    const connection = await odbc.connect(connectionString)

    // Example query
    const result = await connection.query('SELECT * FROM Notes')

    // Log the results
    console.log(result)

    // Close the connection
    await connection.close()
  } catch (err) {
    console.error('Error:', err)
  }
}

main()

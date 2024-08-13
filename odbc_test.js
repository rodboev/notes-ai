const odbc = require('odbc')
const dotenv = require('dotenv').config()

const connectionString = `Driver={FreeTDS};Server=${process.env.SQL_SERVER || '127.0.0.1'};Port=${process.env.SQL_PORT || '1433'};Database=${process.env.SQL_DATABASE};Uid=${process.env.SQL_USERNAME};Pwd=${process.env.SQL_PASSWORD};`

async function query() {
  try {
    const connection = await odbc.connect(connectionString)
    const result = await connection.query('SELECT TOP 10 * FROM Notes')
    console.log(result)
    await connection.close()
  } catch (error) {
    console.error('Error:', error)
  }
}

query()

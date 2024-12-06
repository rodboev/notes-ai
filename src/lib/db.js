import sql from 'mssql/msnodesqlv8.js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../../')

dotenv.config({ path: path.join(projectRoot, '.env') })
dotenv.config({ path: path.join(projectRoot, '.env.local'), override: true })

const config = {
  connectionString: `DSN=${process.env.SQL_DATABASE};UID=${process.env.SQL_USERNAME};PWD=${process.env.SQL_PASSWORD}`,
  options: {
    trustServerCertificate: true,
    encrypt: false,
    enableArithAbort: true,
  },
}

let pool = null

async function getPool() {
  try {
    if (pool) {
      try {
        await pool.request().query('SELECT 1')
        return pool
      } catch (err) {
        console.log('Existing pool failed, creating new connection...')
        pool = null
      }
    }
    pool = await sql.connect(config)
    return pool
  } catch (err) {
    console.error('Database connection error:', err)
    throw err
  }
}

export { sql, getPool }

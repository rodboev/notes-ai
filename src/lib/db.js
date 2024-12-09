import sql from 'mssql/msnodesqlv8.js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../../')

dotenv.config({
  path: path.join(projectRoot, '.env'),
})
dotenv.config({
  path: path.join(projectRoot, '.env.local'),
  override: true,
})

// Single connection config using SSH tunnel
const config = {
  server: process.env.SSH_TUNNEL_SERVER,
  port: parseInt(process.env.SSH_TUNNEL_PORT),
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USERNAME,
  password: process.env.SQL_PASSWORD,
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

    console.log('Connecting with config:', {
      ...config,
      password: '***hidden***',
    })

    pool = await sql.connect(config)
    return pool
  } catch (err) {
    console.error('Database connection error:', err)
    throw err
  }
}

export { sql, getPool }

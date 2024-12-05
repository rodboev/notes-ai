import sql from 'mssql'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../../')

dotenv.config({ path: path.join(projectRoot, '.env') })
dotenv.config({ path: path.join(projectRoot, '.env.local'), override: true })

const config = {
  server: '70.19.53.6',
  port: 1022,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USERNAME,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
    connectionRetryAttempts: 3,
    connectionRetryInterval: 1000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
  },
}

let pool = null

async function connectDB() {
  try {
    if (pool) {
      try {
        await pool.request().query('SELECT 1')
        return pool
      } catch (err) {
        console.log('Existing pool failed, creating new connection...')
        await pool.close()
        pool = null
      }
    }

    // Verify environment variables are loaded
    if (!config.database || !config.user || !config.password) {
      throw new Error('Missing required environment variables for database connection')
    }

    console.log('Connecting to SQL Server with config:', {
      server: config.server,
      port: config.port,
      database: config.database,
      user: config.user,
    })

    pool = await sql.connect(config)
    console.log('Connected to SQL Server via TDS')
    return pool
  } catch (err) {
    console.error('Database connection error:', err)
    throw err
  }
}

export { sql, connectDB }

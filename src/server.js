import fs from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { parse } from 'node:url'
import next from 'next'
import { WebSocketServer } from 'ws'
import dotenv from 'dotenv'
import path from 'node:path'
import fetch from 'node-fetch'
import https from 'node:https'
import { getPool } from './lib/db.js'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })

const hostname = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'

let httpServer
let isHttps = false

if (dev) {
  const keyPath = 'certificates/core-key.pem'
  const certPath = 'certificates/core.pem'

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }
    httpServer = createHttpsServer(httpsOptions)
    isHttps = true
  } else {
    console.warn('HTTPS certificates not found. Falling back to HTTP.')
    httpServer = createHttpServer()
  }
} else {
  httpServer = createHttpServer()
  isHttps = true
}

const webSocketServer = new WebSocketServer({ noServer: true })

const app = next({ dev, hostname, port, customServer: true })
const handle = app.getRequestHandler()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY_VOICE

if (!OPENAI_API_KEY) {
  console.error(`Environment variable "OPENAI_API_KEY_VOICE" is missing.`)
}

let connectedClients = 0

const log = (...args) => console.log('[WebSocket]', ...args)

const handleWebSocketConnection = async (ws, req) => {
  if (process.env.NODE_ENV === 'production') {
    console.log('WebSocket Headers:', {
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-forwarded-port': req.headers['x-forwarded-port'],
      host: req.headers.host,
    })
  }

  const protocol = req.headers['x-forwarded-proto'] || 'ws'
  log(`New WebSocket connection (${protocol}) established. Total clients: ${connectedClients + 1}`)

  connectedClients++

  // Add ping interval for Heroku
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping(() => {}) // Empty callback to handle pong response
    }
  }, 30000) // Send ping every 30 seconds

  // Handle pong responses
  ws.on('pong', () => {
    log('Received pong from client')
  })

  // Clear ping interval on close
  ws.on('close', () => {
    clearInterval(pingInterval)
    log('WebSocket connection closed')
    client.disconnect()
    connectedClients--
  })

  // Add error handling for failed pings
  ws.on('error', (error) => {
    log('WebSocket error:', error)
    clearInterval(pingInterval)
    ws.terminate()
  })

  let RealtimeClient
  try {
    const realtimeModule = await import('@openai/realtime-api-beta')
    RealtimeClient = realtimeModule.RealtimeClient
  } catch (error) {
    log('Failed to import RealtimeClient:', error)
    ws.close()
    return
  }

  log(`Connecting with key "${OPENAI_API_KEY.slice(0, 3)}..."`)
  const client = new RealtimeClient({ apiKey: OPENAI_API_KEY })

  // Relay: OpenAI Realtime API Event -> Browser Event
  client.realtime.on('server.*', (event) => {
    log(`Relaying "${event.type}" to Client: ${Object.keys(event).pop()}`)
    ws.send(JSON.stringify(event))
  })

  client.realtime.on('close', () => ws.close())

  // Relay: Browser Event -> OpenAI Realtime API Event
  const messageQueue = []
  const messageHandler = async (data) => {
    try {
      const event = JSON.parse(data)
      log(`Relaying "${event.type}" to OpenAI`)
      await client.realtime.send(event.type, event)
    } catch (e) {
      console.error(e.message)
      log(`Error parsing event from client: ${data}`)
    }
  }

  ws.on('message', (data) => {
    if (!client.isConnected()) {
      messageQueue.push(data)
    } else {
      messageHandler(data)
    }
  })

  // Connect to OpenAI Realtime API
  try {
    log('Connecting to OpenAI...')
    await client.connect()
    log('Connected to OpenAI successfully!')
    // Process any queued messages
    while (messageQueue.length) {
      await messageHandler(messageQueue.shift())
    }
  } catch (e) {
    log(`Error connecting to OpenAI: ${e.message}`)
    ws.close()
    return
  }
}

webSocketServer.on('connection', handleWebSocketConnection)

const handleRequest = async (req, res) => {
  const { pathname, query } = parse(req.url, true)

  // Add SSL redirect for production
  if (process.env.NODE_ENV === 'production') {
    const proto = req.headers['x-forwarded-proto']
    if (proto && proto !== 'https') {
      res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` })
      res.end()
      return
    }
  }

  // Prepare the log message
  let logMessage = `${req.method} ${req.url}`

  // Truncate fingerprints query string
  if (logMessage.includes('?fingerprints=')) {
    logMessage = `${logMessage.substring(0, 60)}...`
  }

  // Skip logging for specific routes
  if (
    pathname !== '/_next/webpack-hmr' &&
    !(pathname === '/api/tinymce/' && req.method === 'GET')
  ) {
    console.log(logMessage)
  }

  if (pathname === '/_next/webpack-hmr') {
    console.log('Webpack HMR request received')
    console.log(req)
  } else if (pathname === '/api/ws') {
    // Handle the /api/ws request directly
    res.writeHead(200, { 'Content-Type': 'application/json' })
    const responseData = JSON.stringify({
      status: 'available',
      count: connectedClients,
      port,
    })
    console.log('Sending response for /api/ws:', responseData)
    res.end(responseData)
  } else {
    // Handle fingerprint for other routes
    if (query.fingerprints) {
      // Keep the original fingerprint in the request header
      req.headers['x-fingerprint'] = query.fingerprints
    }

    // For all other routes, let Next.js handle the request
    await handle(req, res, { pathname, query })
  }
}

const startServer = async (port) => {
  httpServer
    .on('request', handleRequest)
    .on('upgrade', (req, socket, head) => {
      const { pathname } = parse(req.url)

      if (pathname === '/api/ws') {
        // Check if the connection is coming through Heroku's proxy
        const isSecure = req.headers['x-forwarded-proto'] === 'https'

        // Add headers that WebSocket clients will need
        if (process.env.NODE_ENV === 'production') {
          req.headers['x-forwarded-proto'] = 'wss'
          socket.encrypted = true
        }

        webSocketServer.handleUpgrade(req, socket, head, (ws) => {
          webSocketServer.emit('connection', ws, req)
        })
      } else {
        socket.destroy()
      }
    })
    .listen(port, hostname, () => {
      // In production, always log WSS since clients will connect via Heroku's SSL
      const wsProtocol = process.env.NODE_ENV === 'production' ? 'wss' : isHttps ? 'wss' : 'ws'
      const wsUrl =
        process.env.NODE_ENV === 'production'
          ? `${wsProtocol}://${hostname}/api/ws` // Remove port in production
          : `${wsProtocol}://${hostname}:${port}/api/ws`

      console.log(`▲ Server listening on:`)
      console.log(`- ${isHttps ? 'https' : 'http'}://${hostname}:${port}`)
      console.log(`- ${wsUrl}`)
      console.log(`- Host: ${hostname}`)
      console.log(`- Port: ${port}`)
      console.log(
        `- HTTPS: ${process.env.NODE_ENV === 'production' ? 'enabled (Heroku)' : isHttps ? 'enabled' : 'disabled'}`,
      )
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is in use, trying ${port + 1}...`)
        startServer(port + 1)
      } else {
        console.error('Failed to start server:', err)
        process.exit(1)
      }
    })

  // Preload the root path after the server starts
  if (dev) {
    const protocol = isHttps ? 'https' : 'http'
    const agent = new https.Agent({
      rejectUnauthorized: false,
    })

    fetch(`${protocol}://${hostname}:${port}/`, {
      agent: protocol === 'https' ? agent : undefined,
    })
      .then((response) => {
        if (!response.ok) {
          console.warn('Failed to preload root path:', response.status, response.statusText)
        }
      })
      .catch((error) => {
        console.error('Error preloading root path:', error)
      })
  }
}

;(async () => {
  await app.prepare()
  try {
    // Test SQL connection
    const pool = await getPool()
    const result = await pool.request().query('SELECT TOP 5 * FROM Notes ORDER BY NoteDate DESC')
    console.log('SQL Test Query Result:', result.recordset)
  } catch (err) {
    console.error('Database connection error:', err)
    // Continue starting the server even if DB fails
  }
  startServer(port)
})().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

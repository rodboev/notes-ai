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

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const hostname = 'localhost'
const port = process.env.PORT || 3000
const dev = process.env.NODE_ENV !== 'production'

let httpServer
let isHttps = false

if (dev) {
  const keyPath = './localhost+2-key.pem'
  const certPath = './localhost+2.pem'

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

const handleWebSocketConnection = async (ws) => {
  connectedClients++
  log(`New WebSocket connection established. Total clients: ${connectedClients}`)

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

  ws.on('close', () => {
    log('WebSocket connection closed')
    client.disconnect()
    connectedClients--
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

const preloadRootPath = async (protocol, hostname, port) => {
  try {
    const agent = new https.Agent({
      rejectUnauthorized: false,
    })

    const response = await fetch(`${protocol}://${hostname}:${port}/`, {
      agent: protocol === 'https' ? agent : undefined,
    })

    if (response.ok) {
      console.log('Root path preloaded successfully')
    } else {
      console.error('Failed to preload root path:', response.status, response.statusText)
    }
  } catch (error) {
    console.error('Error preloading root path:', error)
  }
}

const startServer = (port) => {
  httpServer
    .on('request', async (req, res) => {
      const parsedUrl = parse(req.url, true)
      if (parsedUrl.pathname === '/api/ws' /* || parsedUrl.pathname === '/_next/webpack-hmr' */) {
        // Handle the /api/ws request directly
        res.writeHead(200, { 'Content-Type': 'application/json' })
        const responseData = JSON.stringify({
          status: 'available',
          count: connectedClients,
          port: port,
        })
        log('Sending response for /api/ws:', responseData)
        res.end(responseData)
      } else {
        // For all other routes, let Next.js handle the request
        await handle(req, res, parsedUrl)
      }
    })
    .on('upgrade', (req, socket, head) => {
      const { pathname } = parse(req.url)

      if (pathname === '/api/ws' || pathname === '/_next/webpack-hmr') {
        webSocketServer.handleUpgrade(req, socket, head, (ws) => {
          webSocketServer.emit('connection', ws, req)
        })
      } else {
        socket.destroy()
      }
    })
    .listen(port, () => {
      const protocol = isHttps ? 'https' : 'http'
      log(` ▲ Ready on ${protocol}://${hostname}:${port}`)

      // Preload the root path after the server starts
      if (dev) {
        preloadRootPath(protocol, hostname, port)
      }
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        log(`Port ${port} is in use, trying ${port + 1}...`)
        startServer(port + 1)
      } else {
        console.error('Failed to start server:', err)
        process.exit(1)
      }
    })
}

;(async () => {
  await app.prepare()
  startServer(port)
})().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

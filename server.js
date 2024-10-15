import express from 'express'
import http from 'node:http'
import { WebSocketServer } from 'ws'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createServer as createViteServer } from 'vite'
import cors from 'cors'
import fs from 'node:fs'
import { createServer as createHttpsServer } from 'node:https'
import { parse } from 'node:url'

// Import your API route handlers
import * as emailsHandler from './src/api/emails/index.js'
import * as notesHandler from './src/api/notes/index.js'
import * as promptsHandler from './src/api/prompts/index.js'
import * as sendEmailHandler from './src/api/send-email/index.js'
import * as sendFeedbackHandler from './src/api/send-feedback/index.js'
import * as statusHandler from './src/api/status/index.js'

dotenv.config({ path: '.env.local' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hostname = 'localhost'
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : 3001)
const dev = process.env.NODE_ENV !== 'production'

async function createServer() {
  const app = express()

  let server
  let isHttps = false
  let httpsOptions = null

  if (dev) {
    const keyPath = './localhost+2-key.pem'
    const certPath = './localhost+2.pem'

    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
      server = createHttpsServer(httpsOptions, app)
      isHttps = true
      console.log('Using HTTPS with local certificates')
    } else {
      console.warn('HTTPS certificates not found. Falling back to HTTP.')
      server = http.createServer(app)
    }
  } else {
    server = http.createServer(app)
  }

  // Enable CORS for all routes
  app.use(cors())

  app.use(express.json())

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`[Express] ${req.method} ${req.url}`)
    next()
  })

  // Set up your API routes
  const apiRoutes = {
    emails: emailsHandler,
    notes: notesHandler,
    prompts: promptsHandler,
    'send-email': sendEmailHandler,
    'send-feedback': sendFeedbackHandler,
    status: statusHandler,
  }

  for (const [route, handler] of Object.entries(apiRoutes)) {
    app.use(`/api/${route}`, (req, res, next) => {
      console.log(`[Express] Handling ${req.method} request for /api/${route}`)
      const method = req.method.toLowerCase()
      if (handler[method]) {
        return handler[method](req, res, next)
      }
      return res.status(405).send('Method Not Allowed')
    })
  }

  let vite

  if (dev) {
    // Create Vite server in middleware mode
    vite = await createViteServer({
      server: {
        middlewareMode: true,
        https: httpsOptions, // Pass HTTPS options to Vite
      },
      appType: 'custom',
      hmr: {
        server: server,
        port: 24678,
        https: isHttps, // Enable HTTPS for HMR if using HTTPS
      },
    })

    // Use vite's connect instance as middleware
    app.use(vite.middlewares)
  } else {
    // Serve static files from the 'dist' directory in production
    app.use(express.static(path.resolve(__dirname, 'dist')))
  }

  const webSocketServer = new WebSocketServer({ noServer: true })

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

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url)

    if (pathname === '/api/ws') {
      webSocketServer.handleUpgrade(req, socket, head, (ws) => {
        webSocketServer.emit('connection', ws, req)
      })
    } else if (vite?.ws.handleUpgrade(req, socket, head)) {
      // Vite handles its own upgrade
      return
    } else {
      socket.destroy()
    }
  })

  app.get('/api/ws', (req, res) => {
    res.json({
      status: 'available',
      count: connectedClients,
      port: PORT,
    })
  })

  app.use('*', async (req, res, next) => {
    try {
      if (dev) {
        // In development, let Vite handle the request
        const template = await vite.transformIndexHtml(req.originalUrl, '')
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
      } else {
        // In production, serve the built index.html
        const indexPath = path.resolve(__dirname, 'dist/index.html')
        const html = fs.readFileSync(indexPath, 'utf-8')
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
      }
    } catch (e) {
      if (dev) {
        vite.ssrFixStacktrace(e)
      }
      next(e)
    }
  })

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log('Address in use, retrying...')
      setTimeout(() => {
        server.close()
        server.listen(PORT, hostname)
      }, 1000)
    }
  })

  server.listen(PORT, () => {
    const protocol = isHttps ? 'https' : 'http'
    console.log(`[Express] Server running on ${protocol}://${hostname}:${PORT}`)
  })
}

createServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

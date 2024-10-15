import fs from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { parse } from 'node:url'
import { WebSocketServer } from 'ws'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createServer as createViteServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const hostname = 'localhost'
const port = process.env.PORT || 3000
const dev = process.env.NODE_ENV !== 'production'

async function createServer() {
  const app = express()

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
      httpServer = createHttpsServer(httpsOptions, app)
      isHttps = true
    } else {
      console.warn('HTTPS certificates not found. Falling back to HTTP.')
      httpServer = createHttpServer(app)
    }
  } else {
    httpServer = createHttpServer(app)
  }

  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      https: isHttps
        ? {
            key: fs.readFileSync('./localhost+2-key.pem'),
            cert: fs.readFileSync('./localhost+2.pem'),
          }
        : false,
    },
    appType: 'custom',
    hmr: {
      server: httpServer,
      protocol: isHttps ? 'wss' : 'ws',
      port: 24678,
    },
  })

  app.use(vite.middlewares)

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

  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url)

    if (pathname === '/api/ws') {
      webSocketServer.handleUpgrade(req, socket, head, (ws) => {
        webSocketServer.emit('connection', ws, req)
      })
    } else if (vite.ws.handleUpgrade(req, socket, head)) {
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
      port: port,
    })
  })

  // Serve static files from the 'dist' directory in production
  if (!dev) {
    app.use(express.static(path.resolve(__dirname, '../dist')))
  }

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl

    try {
      const template = await vite.transformIndexHtml(url, '')
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
    } catch (e) {
      vite.ssrFixStacktrace(e)
      next(e)
    }
  })

  httpServer.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log('Address in use, retrying...')
      setTimeout(() => {
        httpServer.close()
        httpServer.listen(port, hostname)
      }, 1000)
    }
  })

  httpServer.listen(port, () => {
    const protocol = isHttps ? 'https' : 'http'
    log(` ▲ Ready on ${protocol}://${hostname}:${port}`)
  })
}

createServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

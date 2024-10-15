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
import chalk from 'chalk'

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
      console.warn(chalk.yellow('HTTPS certificates not found. Falling back to HTTP.'))
      httpServer = createHttpServer(app)
    }
  } else {
    httpServer = createHttpServer(app)
  }

  let vite

  if (dev) {
    // Create Vite server in middleware mode
    vite = await createViteServer({
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
      logLevel: 'info',
      clearScreen: false,
    })

    // Capture Vite's console output
    const originalConsole = console
    console = new Proxy(console, {
      get: (target, prop) => {
        if (prop === 'log' || prop === 'warn' || prop === 'error') {
          return (...args) => {
            if (args[0] && typeof args[0] === 'string' && args[0].includes('[vite]')) {
              originalConsole[prop](chalk.cyan(...args))
            } else {
              originalConsole[prop](...args)
            }
          }
        }
        return target[prop]
      },
    })

    // Use vite's connect instance as middleware
    app.use(vite.middlewares)
  } else {
    // Serve static files from the 'dist' directory in production
    app.use(express.static(path.resolve(__dirname, '../dist')))
  }

  const webSocketServer = new WebSocketServer({ noServer: true })

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY_VOICE

  if (!OPENAI_API_KEY) {
    console.error(chalk.red(`Environment variable "OPENAI_API_KEY_VOICE" is missing.`))
  }

  let connectedClients = 0

  const log = (...args) => console.log(chalk.blue('[WebSocket]'), ...args)

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
    } else if (dev && vite.ws.handleUpgrade(req, socket, head)) {
      // Vite handles its own upgrade in development mode
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

  app.use('*', async (req, res, next) => {
    try {
      if (dev) {
        // In development, let Vite handle the request
        vite.middlewares(req, res, next)
      } else {
        // In production, serve the built index.html
        const indexPath = path.resolve(__dirname, '../dist/index.html')
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

  httpServer.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(chalk.yellow('Address in use, retrying...'))
      setTimeout(() => {
        httpServer.close()
        httpServer.listen(port, hostname)
      }, 1000)
    }
  })

  httpServer.listen(port, () => {
    const protocol = isHttps ? 'https' : 'http'
    console.log(chalk.green(`Server started successfully`))
    console.log(chalk.blue(` ▲ Ready on ${protocol}://${hostname}:${port}`))
    if (dev) {
      console.log(
        chalk.cyan(`[Vite] HMR websocket server running on ${protocol}://${hostname}:24678`),
      )
      console.log(chalk.yellow(`Running in development mode`))
    } else {
      console.log(chalk.green(`Running in production mode`))
    }
  })
}

createServer().catch((err) => {
  console.error(chalk.red('Failed to start server:'), err)
  process.exit(1)
})

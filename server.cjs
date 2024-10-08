const fs = require('fs')
const { Server } = require('node:https')
const { parse } = require('node:url')
const next = require('next')
const { setHttpServer, setWebSocketServer } = require('next-ws/server')
const { WebSocketServer } = require('ws')
require('dotenv').config()

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3000

const httpsOptions = {
  key: fs.readFileSync('./localhost+2-key.pem'),
  cert: fs.readFileSync('./localhost+2.pem'),
}

const httpServer = new Server(httpsOptions)
setHttpServer(httpServer)
const webSocketServer = new WebSocketServer({ noServer: true })
setWebSocketServer(webSocketServer)

const app = next({ dev, hostname, port, customServer: true })
const handle = app.getRequestHandler()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY_VOICE

if (!OPENAI_API_KEY) {
  console.error(`Environment variable "OPENAI_API_KEY_VOICE" is missing.`)
}

let connectedClients = 0

const log = (...args) => console.log('[RealtimeRelay]', ...args)

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
    log(`Relaying "${event.type}" to Client: ${JSON.stringify(event)}`)
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
;(async () => {
  await app.prepare()

  httpServer
    .on('request', async (req, res) => {
      const parsedUrl = parse(req.url, true)
      if (parsedUrl.pathname === '/api/ws') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        const responseData = JSON.stringify({ status: 'available', count: connectedClients })
        log('Sending response for /api/ws:', responseData)
        res.end(responseData)
      } else {
        await handle(req, res, parsedUrl)
      }
    })
    .listen(port, () => {
      log(` ▲ Ready on https://${hostname}:${port}`)
    })
})().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

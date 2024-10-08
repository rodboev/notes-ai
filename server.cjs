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

  const client = new RealtimeClient({ apiKey: OPENAI_API_KEY })
  const messageQueue = []

  client.realtime.on('server.*', (event) => {
    log(`Relaying "${event.type}" to Client: ${JSON.stringify(event)}`)
    ws.send(JSON.stringify(event))
  })

  client.realtime.on('close', () => {
    log('OpenAI connection closed')
    ws.close()
  })

  client.realtime.on('error', (error) => {
    log('OpenAI Realtime API error:', error)
    ws.send(JSON.stringify({ type: 'error', message: error.message }))
  })

  const messageHandler = async (data) => {
    try {
      const event = JSON.parse(data)
      log(`Relaying "${event.type}" to OpenAI`)
      client.realtime.send(event.type, event)
    } catch (e) {
      log(`Error parsing event from client: ${data}`)
      ws.send(JSON.stringify({ type: 'error', message: 'Error parsing event' }))
    }
  }

  ws.on('message', async (data) => {
    log(`Received message from client: ${data}`)
    const event = JSON.parse(data)
    if (event.type === 'connect') {
      try {
        log('Connecting to OpenAI...')
        await client.connect()
        log('Connected to OpenAI successfully!')
        ws.send(JSON.stringify({ type: 'connected' }))
        // Process any queued messages
        while (messageQueue.length > 0) {
          await messageHandler(messageQueue.shift())
        }
      } catch (e) {
        log(`Error connecting to OpenAI: ${e.message}`)
        ws.send(
          JSON.stringify({ type: 'error', message: `Error connecting to OpenAI: ${e.message}` }),
        )
      }
    } else if (client.isConnected()) {
      await messageHandler(data)
    } else {
      messageQueue.push(data)
    }
  })

  ws.on('close', () => {
    log('WebSocket connection closed')
    client.disconnect()
    connectedClients--
  })

  ws.on('error', (error) => {
    log(`WebSocket error:`, error)
    ws.send(JSON.stringify({ type: 'error', message: 'WebSocket error occurred' }))
  })
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

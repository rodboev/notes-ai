const { createServer } = require('https')
const fs = require('fs')
const { setHttpServer, setWebSocketServer } = require('next-ws/server')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer } = require('ws')
require('dotenv').config()

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3000

const httpsOptions = {
  key: fs.readFileSync('./localhost+2-key.pem'),
  cert: fs.readFileSync('./localhost+2.pem'),
}

const httpsServer = createServer(httpsOptions)
setHttpServer(httpsServer)
const webSocketServer = new WebSocketServer({ noServer: true })
setWebSocketServer(webSocketServer)

const app = next({ dev, hostname, port, customServer: true })
const handle = app.getRequestHandler()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY_VOICE

if (!OPENAI_API_KEY) {
  console.error(`Environment variable "OPENAI_API_KEY_VOICE" is missing.`)
}

let connectedClients = 0

;(async () => {
  let RealtimeClient
  try {
    const realtimeModule = await import('@openai/realtime-api-beta')
    RealtimeClient = realtimeModule.RealtimeClient
  } catch (error) {
    console.error('Failed to import RealtimeClient:', error)
    process.exit(1)
  }

  httpsServer.on('upgrade', (request, socket, head) => {
    webSocketServer.handleUpgrade(request, socket, head, (ws) => {
      webSocketServer.emit('connection', ws, request)
    })
  })

  webSocketServer.on('connection', (ws) => {
    console.log('New WebSocket connection established')
    connectedClients++

    const client = new RealtimeClient({ apiKey: OPENAI_API_KEY })

    client.realtime.on('server.*', (event) => {
      console.log(`Relaying "${event.type}" to Client, keys: ${Object.keys(event)}`)
      ws.send(JSON.stringify(event))
    })

    client.realtime.on('close', () => {
      console.log('OpenAI connection closed')
      ws.close()
    })

    client.realtime.on('error', (error) => {
      console.error('OpenAI Realtime API error:', error)
      ws.send(JSON.stringify({ type: 'error', message: error.message }))
    })

    const messageQueue = []
    const messageHandler = (data) => {
      try {
        const event = JSON.parse(data)
        console.log(`Relaying "${event.type}" to OpenAI:`, event)
        client.realtime.send(event.type, event)
      } catch (e) {
        console.error('Error parsing event from client:', e)
        ws.send(JSON.stringify({ type: 'error', message: 'Error parsing event' }))
      }
    }

    ws.on('message', (data) => {
      console.log(`Received message from client: ${data}`)
      if (!client.isConnected()) {
        console.log('Client not connected, queueing message')
        messageQueue.push(data)
      } else {
        messageHandler(data)
      }
    })

    ws.on('close', () => {
      console.log('WebSocket connection closed')
      client.disconnect()
      connectedClients--
    })

    ws.on('error', (error) => {
      console.error(`WebSocket error:`, error)
      ws.send(JSON.stringify({ type: 'error', message: 'WebSocket error occurred' }))
    })

    client
      .connect()
      .then(() => {
        console.log(`Connected to OpenAI successfully!`)
        while (messageQueue.length) {
          messageHandler(messageQueue.shift())
        }
        ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to WebSocket server' }))
      })
      .catch((e) => {
        console.error(`Error connecting to OpenAI:`, e)
        ws.send(
          JSON.stringify({ type: 'error', message: `Error connecting to OpenAI: ${e.message}` }),
        )
        ws.close()
      })
  })

  await app.prepare()

  httpsServer
    .on('request', async (req, res) => {
      const parsedUrl = parse(req.url, true)
      if (parsedUrl.pathname === '/api/ws') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'available', count: connectedClients }))
      } else {
        await handle(req, res, parsedUrl)
      }
    })
    .listen(port, () => {
      console.log(` ▲ Ready on https://${hostname}:${port}`)
    })
})().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

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
let RealtimeClient

// Add this function to log outgoing messages
const logOutgoingMessage = (message) => {
  console.log('Sending message to client:', message)
}

;(async () => {
  try {
    const realtimeModule = await import('@openai/realtime-api-beta')
    RealtimeClient = realtimeModule.RealtimeClient
  } catch (error) {
    console.error('Failed to import RealtimeClient:', error)
    process.exit(1)
  }

  webSocketServer.on('connection', (ws, request) => {
    console.log('New WebSocket connection established')
    connectedClients++
    console.log(`Total connected clients: ${connectedClients}`)

    const client = new RealtimeClient({ apiKey: OPENAI_API_KEY })

    client.on('conversation.updated', (event) => {
      console.log(`Relaying "conversation.updated" to Client, keys: ${Object.keys(event)}`)
      const message = JSON.stringify({ type: 'conversation.updated', ...event })
      logOutgoingMessage(message)
      ws.send(message)
    })

    client.on('conversation.interrupted', (event) => {
      console.log(`Relaying "conversation.interrupted" to Client`)
      const message = JSON.stringify({ type: 'conversation.interrupted', ...event })
      logOutgoingMessage(message)
      ws.send(message)
    })

    client.on('error', (error) => {
      console.error('OpenAI Realtime API error:', error)
      const message = JSON.stringify({ type: 'error', message: error.message })
      logOutgoingMessage(message)
      ws.send(message)
    })

    ws.on('message', async (data) => {
      console.log(`Received message from client: ${data}`)
      try {
        const event = JSON.parse(data)
        if (event.type === 'connect') {
          await client.connect()
          console.log('Connected to OpenAI successfully!')
          ws.send(JSON.stringify({ type: 'connected' }))
        } else if (client.isConnected()) {
          console.log(`Handling "${event.type}" from client:`, event)
          switch (event.type) {
            case 'updateSession':
              await client.updateSession(event.data)
              break
            case 'sendUserMessageContent':
              await client.sendUserMessageContent(event.data)
              break
            case 'appendInputAudio':
              await client.appendInputAudio(event.data)
              break
            default:
              console.warn(`Unhandled event type: ${event.type}`)
          }
        } else {
          console.error('Client not connected, cannot send message')
          ws.send(JSON.stringify({ type: 'error', message: 'Not connected to OpenAI' }))
        }
      } catch (e) {
        console.error('Error handling client message:', e)
        ws.send(JSON.stringify({ type: 'error', message: 'Error handling message' }))
      }
    })

    ws.on('close', () => {
      console.log('WebSocket connection closed')
      client.disconnect()
      connectedClients--
    })

    ws.on('error', (error) => {
      console.error(`WebSocket error:`, error)
      const message = JSON.stringify({ type: 'error', message: 'WebSocket error occurred' })
      logOutgoingMessage(message)
      ws.send(message)
    })
  })

  await app.prepare()

  httpServer
    .on('request', async (req, res) => {
      const parsedUrl = parse(req.url, true)
      if (parsedUrl.pathname === '/api/ws') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        const responseData = JSON.stringify({ status: 'available', count: connectedClients })
        console.log('Sending response for /api/ws:', responseData)
        res.end(responseData)
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

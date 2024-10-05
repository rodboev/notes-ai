import { WebSocketServer } from 'ws'
import { RealtimeClient } from '@openai/realtime-api-beta'
import dotenv from 'dotenv'

dotenv.config({ override: true })

// Ensure consistency in environment variable naming
const OPENAI_API_KEY = process.env.OPENAI_API_KEY // Changed from OPENAI_API_VOICE_KEY to OPENAI_API_KEY

if (!OPENAI_API_KEY) {
  console.error(
    `Environment variable "OPENAI_API_KEY" is required.\n` + `Please set it in your .env file.`,
  )
  process.exit(1)
}

const PORT = 49152

class RealtimeRelay {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.wss = null
  }

  listen(port) {
    this.wss = new WebSocketServer({ port })
    this.wss.on('connection', this.connectionHandler.bind(this))
    this.log(`Listening on ws://localhost:${port}`)
  }

  async connectionHandler(ws, req) {
    if (!req.url) {
      this.log('No URL provided, closing connection.')
      ws.close()
      return
    }

    const url = new URL(req.url, `http://${req.headers.host}`)
    const pathname = url.pathname

    if (pathname !== '/') {
      this.log(`Invalid pathname: "${pathname}"`)
      ws.close()
      return
    }

    // Instantiate new RealtimeClient but do not connect yet
    this.log(`Received new WebSocket connection. Awaiting 'connect' message.`)
    const client = new RealtimeClient({ apiKey: this.apiKey })

    let openAIConnected = false
    const messageQueue = []

    client.on('connected', () => {
      this.log('Connected to OpenAI Realtime API')
      openAIConnected = true
      ws.send(JSON.stringify({ type: 'connection_status', status: 'connected' }))
      this.processMessageQueue(messageQueue, client, ws)
    })

    client.on('disconnected', () => {
      this.log('Disconnected from OpenAI Realtime API')
      openAIConnected = false
      ws.send(JSON.stringify({ type: 'connection_status', status: 'disconnected' }))
    })

    client.on('error', (error) => {
      this.log('OpenAI Realtime API error:', error)
      ws.send(JSON.stringify({ type: 'error', message: error.message }))
    })

    client.realtime.on('server.*', (event) => {
      this.log(`Relaying from OpenAI to client: ${event.type}`)
      ws.send(JSON.stringify(event))
    })

    const messageHandler = (event) => {
      try {
        const parsedEvent = JSON.parse(event)
        this.log(`Relaying from client: ${parsedEvent.type}`)

        if (parsedEvent.type === 'connect') {
          if (!openAIConnected) {
            client.connect().catch((error) => {
              this.log('Error connecting to OpenAI:', error)
              ws.send(JSON.stringify({ type: 'error', message: 'Failed to connect to OpenAI' }))
            })
          } else {
            this.log('Already connected to OpenAI. Ignoring connect message.')
          }
        } else if (parsedEvent.type === 'disconnect') {
          if (openAIConnected) {
            client.disconnect()
          } else {
            this.log('Already disconnected from OpenAI.')
          }
        } else if (openAIConnected) {
          client.realtime.send(parsedEvent.type, parsedEvent)
        } else {
          this.log('Received message while not connected to OpenAI')
          ws.send(JSON.stringify({ type: 'error', message: 'Not connected to OpenAI' }))
        }
      } catch (e) {
        this.log('Error processing message:', e)
        ws.send(JSON.stringify({ type: 'error', message: 'Error processing message' }))
      }
    }

    ws.on('message', (data) => {
      try {
        const event = JSON.parse(data)
        if (event.type === 'connect' || event.type === 'disconnect') {
          // Always handle 'connect' and 'disconnect' messages immediately
          messageHandler(data)
        } else if (openAIConnected) {
          // Handle other messages only if connected
          messageHandler(data)
        } else {
          // Queue messages that aren't 'connect' or 'disconnect'
          this.log('OpenAI not connected yet, queueing message')
          messageQueue.push(data)
        }
      } catch (e) {
        this.log('Error parsing incoming message:', e)
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
      }
    })

    ws.on('close', () => {
      this.log('WebSocket connection closed with client')
      if (openAIConnected) {
        client.disconnect()
      }
    })
  }

  processMessageQueue(queue, client, ws) {
    while (queue.length > 0) {
      const message = queue.shift()
      try {
        const event = JSON.parse(message)
        this.log(`Relaying queued message: ${event.type}`)
        client.realtime.send(event.type, event)
      } catch (e) {
        this.log('Error processing queued message:', e)
        ws.send(JSON.stringify({ type: 'error', message: 'Error processing queued message' }))
      }
    }
  }

  log(...args) {
    console.log(`[RealtimeRelay]`, ...args)
  }
}

const relay = new RealtimeRelay(OPENAI_API_KEY)
relay.listen(PORT)

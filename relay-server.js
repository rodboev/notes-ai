import { WebSocketServer } from 'ws'
import { RealtimeClient } from '@openai/realtime-api-beta'
import dotenv from 'dotenv'

dotenv.config()

const OPENAI_API_KEY = process.env.OPENAI_API_VOICE_KEY

if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not set in environment variables.')
  process.exit(1)
}

export class RealtimeRelay {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.wss = null
  }

  listen(port) {
    this.wss = new WebSocketServer({ port })
    this.wss.on('connection', this.handleConnection.bind(this))
    console.log(`WebSocket server listening on ws://localhost:${port}`)
  }

  async handleConnection(ws) {
    console.log('WebSocket connection established with client')

    const client = new RealtimeClient({ apiKey: this.apiKey })
    let openAIConnected = false
    const messageQueue = []

    client.on('connected', () => {
      console.log('Connected to OpenAI Realtime API')
      openAIConnected = true
      ws.send(JSON.stringify({ type: 'connection_status', status: 'connected' }))
      this.processMessageQueue(messageQueue, client, ws)
    })

    client.on('disconnected', () => {
      console.log('Disconnected from OpenAI Realtime API')
      openAIConnected = false
      ws.send(JSON.stringify({ type: 'connection_status', status: 'disconnected' }))
    })

    client.on('error', (error) => {
      console.error('OpenAI Realtime API error:', error)
      ws.send(JSON.stringify({ type: 'error', message: error.message }))
    })

    client.realtime.on('server.*', (serverEvent) => {
      console.log(`Relaying from OpenAI to client:`, serverEvent.type)
      ws.send(JSON.stringify(serverEvent))
    })

    const messageHandler = async (data) => {
      try {
        const event = JSON.parse(data)
        console.log(`Received from client:`, event.type)

        if (event.type === 'connect' && !openAIConnected) {
          try {
            await client.connect()
          } catch (error) {
            console.error('Error connecting to OpenAI:', error)
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to connect to OpenAI' }))
          }
        } else if (event.type === 'disconnect' && openAIConnected) {
          client.disconnect()
        } else if (openAIConnected) {
          client.realtime.send(event.type, event)
        } else {
          console.warn('Received message while not connected to OpenAI')
          ws.send(JSON.stringify({ type: 'error', message: 'Not connected to OpenAI' }))
        }
      } catch (e) {
        console.error('Error processing message:', e)
        ws.send(JSON.stringify({ type: 'error', message: 'Error processing message' }))
      }
    }

    ws.on('message', (data) => {
      if (!openAIConnected) {
        console.log('OpenAI not connected yet, queueing message')
        messageQueue.push(data)
      } else {
        messageHandler(data)
      }
    })

    ws.on('close', () => {
      console.log('WebSocket connection closed with client')
      if (openAIConnected) {
        client.disconnect()
      }
    })
  }

  processMessageQueue(queue, client, ws) {
    while (queue.length > 0) {
      const message = queue.shift()
      this.handleMessage(message, client, ws)
    }
  }
}

const WS_PORT = 49152
const relay = new RealtimeRelay(OPENAI_API_KEY)
relay.listen(WS_PORT)

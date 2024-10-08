import { RealtimeClient } from '@openai/realtime-api-beta'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY_VOICE

if (!OPENAI_API_KEY) {
  console.error(`Environment variable "OPENAI_API_KEY_VOICE" is missing.`)
}

let connectedClients = 0

export function SOCKET(ws, request, server) {
  console.log('New WebSocket connection established')
  connectedClients++

  // Instantiate new client
  console.log(`Connecting with key "${OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 3) : 'MISSING'}..."`)
  const client = new RealtimeClient({ apiKey: OPENAI_API_KEY })

  // Relay: OpenAI Realtime API Event -> Browser Event
  client.realtime.on('server.*', (event) => {
    console.log(`Relaying "${event.type}" to Client: ${JSON.stringify(event)}`)
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

  // Relay: Browser Event -> OpenAI Realtime API Event
  const messageQueue = []
  const messageHandler = (data) => {
    try {
      const event = JSON.parse(data)
      console.log(`Relaying "${event.type}" to OpenAI`)
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

  // Connect to OpenAI Realtime API
  client
    .connect()
    .then(() => {
      console.log(`Connected to OpenAI successfully!`)
      while (messageQueue.length) {
        messageHandler(messageQueue.shift())
      }
      // Send a welcome message
      ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to WebSocket server' }))
    })
    .catch((e) => {
      console.error(`Error connecting to OpenAI:`, e)
      ws.send(
        JSON.stringify({ type: 'error', message: `Error connecting to OpenAI: ${e.message}` }),
      )
      ws.close()
    })
}

export async function GET(req) {
  const response = {
    status: 'available',
    clientsCount: connectedClients,
  }
  console.log('WebSocket status:', response)
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

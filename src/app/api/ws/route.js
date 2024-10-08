import { RealtimeClient } from '@openai/realtime-api-beta'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY_VOICE

if (!OPENAI_API_KEY) {
  console.error(`Environment variable "OPENAI_API_KEY_VOICE" is missing.`)
}

let connectedClients = 0

export function SOCKET(client, request, server) {
  console.log('New WebSocket connection established')
  connectedClients++

  // Instantiate new client
  console.log(`Connecting with key "${OPENAI_API_KEY ? OPENAI_API_KEY.slice(0, 3) : 'MISSING'}..."`)
  const realtimeClient = new RealtimeClient({ apiKey: OPENAI_API_KEY })

  // Relay: OpenAI Realtime API Event -> Browser Event
  realtimeClient.realtime.on('server.*', (event) => {
    console.log(`Relaying "${event.type}" to Client: ${JSON.stringify(event)}`)
    client.send(JSON.stringify(event))
  })
  realtimeClient.realtime.on('close', () => {
    console.log('OpenAI connection closed')
    client.close()
  })
  realtimeClient.realtime.on('error', (error) => {
    console.error('OpenAI Realtime API error:', error)
    client.send(JSON.stringify({ type: 'error', message: error.message }))
  })

  // Relay: Browser Event -> OpenAI Realtime API Event
  const messageQueue = []
  const messageHandler = (data) => {
    try {
      const event = JSON.parse(data)
      console.log(`Relaying "${event.type}" to OpenAI`)
      realtimeClient.realtime.send(event.type, event)
    } catch (e) {
      console.error('Error parsing event from client:', e)
      client.send(JSON.stringify({ type: 'error', message: 'Error parsing event' }))
    }
  }
  client.on('message', (data) => {
    console.log(`Received message from client: ${data}`)
    if (!realtimeClient.isConnected()) {
      console.log('Client not connected, queueing message')
      messageQueue.push(data)
    } else {
      messageHandler(data)
    }
  })
  client.on('close', () => {
    console.log('WebSocket connection closed')
    realtimeClient.disconnect()
    connectedClients--
  })
  client.on('error', (error) => {
    console.error(`WebSocket error:`, error)
    client.send(JSON.stringify({ type: 'error', message: 'WebSocket error occurred' }))
  })

  // Connect to OpenAI Realtime API
  realtimeClient
    .connect()
    .then(() => {
      console.log(`Connected to OpenAI successfully!`)
      while (messageQueue.length) {
        messageHandler(messageQueue.shift())
      }
      // Send a welcome message
      client.send(JSON.stringify({ type: 'welcome', message: 'Connected to WebSocket server' }))
    })
    .catch((e) => {
      console.error(`Error connecting to OpenAI:`, e)
      client.send(
        JSON.stringify({ type: 'error', message: `Error connecting to OpenAI: ${e.message}` }),
      )
      client.close()
    })
}

export async function GET(req) {
  console.log('GET function called in ws/route.js')
  return new Response(
    JSON.stringify({
      status: 'available',
      clientsCount: connectedClients,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

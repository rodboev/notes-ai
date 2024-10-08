import { RealtimeClient } from '@openai/realtime-api-beta'

export function GET() {
  return Response.json({ status: 'available' })
}

export function SOCKET(ws, request, server) {
  console.log('WebSocket connection received in SOCKET handler')

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY_VOICE

  if (!OPENAI_API_KEY) {
    console.error(`Environment variable "OPENAI_API_KEY_VOICE" is missing.`)
    ws.close()
    return
  }

  let connectedClients = 0

  connectedClients++
  console.log(`New WebSocket connection established. Total clients: ${connectedClients}`)

  console.log(`Connecting with key "${OPENAI_API_KEY.slice(0, 3)}..."`)
  const client = new RealtimeClient({ apiKey: OPENAI_API_KEY })

  // Relay: OpenAI Realtime API Event -> Browser Event
  client.realtime.on('server.*', (event) => {
    console.log(`Relaying "${event.type}" to Client: ${Object.keys(event).pop()}`)
    ws.send(JSON.stringify(event))
  })

  client.realtime.on('close', () => ws.close())

  // Relay: Browser Event -> OpenAI Realtime API Event
  const messageQueue = []
  const messageHandler = async (data) => {
    try {
      const event = JSON.parse(data)
      console.log(`Received "${event.type}" from client`)
      switch (event.type) {
        case 'session.update':
          await client.updateSession(event.data)
          break
        case 'conversation.item.create':
          await client.sendUserMessageContent(event.data)
          break
        case 'input_audio_buffer.append':
          await client.appendInputAudio(event.data)
          break
        case 'response.cancel':
          await client.cancelResponse(event.trackId, event.offset)
          break
        default:
          console.log(`Unhandled event type: ${event.type}`)
      }
    } catch (e) {
      console.error(e.message)
      console.log(`Error handling event from client: ${data}`)
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
    console.log('WebSocket connection closed')
    client.disconnect()
    connectedClients--
  })

  // Connect to OpenAI Realtime API
  const connectToOpenAI = async () => {
    try {
      console.log('Connecting to OpenAI...')
      await client.connect()
      console.log('Connected to OpenAI successfully!')
      // Process any queued messages
      while (messageQueue.length) {
        await messageHandler(messageQueue.shift())
      }
    } catch (e) {
      console.log(`Error connecting to OpenAI: ${e.message}`)
      ws.close()
      return
    }
  }

  // Wait for the 'connect' message from the client before connecting to OpenAI
  ws.on('message', async (data) => {
    const event = JSON.parse(data)
    if (event.type === 'connect') {
      await connectToOpenAI()
      ws.send(JSON.stringify({ type: 'connected' }))
    } else {
      messageHandler(data)
    }
  })
}

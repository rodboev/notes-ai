import { NextResponse } from 'next/server'
import { RealtimeClient } from '@openai/realtime-api-beta'
import { WebSocketServer } from 'ws'

let wss = null

function initWebSocketServer(server) {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true })

    wss.on('connection', (ws) => {
      const client = new RealtimeClient({ apiKey: process.env.OPENAI_API_KEY })

      client.on('server.*', (serverEvent) => {
        ws.send(JSON.stringify(serverEvent))
      })

      ws.on('message', async (message) => {
        const event = JSON.parse(message)
        if (!client.isConnected()) {
          await client.connect()
        }
        client.realtime.send(event.type, event)
      })

      ws.on('close', () => {
        client.disconnect()
      })
    })

    server.on('upgrade', (request, socket, head) => {
      if (request.url === '/api/audio') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request)
        })
      }
    })
  }
}

export function GET(req) {
  const { server } = req.socket
  initWebSocketServer(server)

  return new NextResponse('WebSocket server is running.', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}

export function POST(req) {
  return new NextResponse('WebSocket connection required.', {
    status: 426,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}

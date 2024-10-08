import { getWebSocketServer } from 'next-ws/server'

export function GET() {
  const wsServer = getWebSocketServer()
  return Response.json({ count: wsServer.clients.size })
}

export function SOCKET(client, request, server) {
  console.log('WebSocket connection received in SOCKET handler')

  // Forward the connection to our custom WebSocket server
  server.emit('connection', client, request)
}

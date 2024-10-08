export function GET() {
  return Response.json({ status: 'available' })
}

export function SOCKET(client, request, server) {
  console.log('WebSocket connection received in SOCKET handler')
  // Forward the connection to our custom WebSocket server
  server.emit('connection', client, request)
}

export function GET() {
  const headers = new Headers()
  headers.set('Connection', 'Upgrade')
  headers.set('Upgrade', 'websocket')
  return new Response('Upgrade Required', { status: 426, headers })
}

export function SOCKET(client, request, server) {
  console.log('WebSocket connection received in SOCKET handler')

  // You can add any additional logic here if needed
  client.on('message', (message) => {
    console.log('Message received in SOCKET handler:', message.toString())
    // You can add any additional processing here if needed
  })

  client.on('close', () => {
    console.log('WebSocket connection closed in SOCKET handler')
  })
}

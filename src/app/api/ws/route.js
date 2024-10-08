import { getWebSocketServer } from 'next-ws/server'

export function GET() {
  const wsServer = getWebSocketServer()
  return Response.json({ count: wsServer.clients.size })
}

export function SOCKET(client, _request, server) {
  const { send, broadcast } = createHelpers(client, server)

  // When a new client connects broadcast a connect message
  broadcast({ author: 'Server', content: 'A new client has connected.' })
  send({ author: 'Server', content: 'Welcome!' })

  // Relay any message back to other clients
  client.on('message', broadcast)

  // When this client disconnects broadcast a disconnect message
  client.on('close', () => {
    broadcast({ author: 'Server', content: 'A client has disconnected.' })
  })
}

function createHelpers(client, server) {
  const send = (payload) => client.send(JSON.stringify(payload))
  const broadcast = (payload) => {
    if (payload instanceof Buffer) payload = payload.toString()
    if (typeof payload !== 'string') payload = JSON.stringify(payload)
    for (const other of server.clients) if (other !== client) other.send(String(payload))
  }
  return { send, broadcast }
}

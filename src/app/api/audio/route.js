import { NextResponse } from 'next/server'
import { RealtimeClient } from '@openai/realtime-api-beta'

export async function POST(req) {
  const client = new RealtimeClient({ apiKey: process.env.OPENAI_API_KEY })

  const { event } = await req.json()

  return new NextResponse(
    new ReadableStream({
      async start(controller) {
        client.on('server.*', (serverEvent) => {
          controller.enqueue(JSON.stringify(serverEvent))
        })

        await client.connect()

        client.realtime.send(event.type, event)

        client.on('close', () => {
          controller.close()
        })
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    },
  )
}

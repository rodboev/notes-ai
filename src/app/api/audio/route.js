import { NextResponse } from 'next/server'
import { RealtimeClient } from '@openai/realtime-api-beta'

let client = null

async function initializeClient(technicianNote) {
  if (!client) {
    client = new RealtimeClient({ apiKey: process.env.OPENAI_API_VOICE_KEY })

    client.updateSession({
      instructions: `You work in the Service Department at Liberty Pest Control. You will introduce yourself as "Jerry, your personal liaison from Liberty Pest Control". Each day, the company receives notes from technicians out in the field which contain work done and upsale opportunities like infestations, and potential treatments or additional maintenance. You will be calling a customer after their service to summarize the work done, and emphasize upsale opportunities. Customers already get scheduled maintenance, so we want to highlight opportunities to increase the frequency of visits. First find out if the customer has moment to speak and be updated on our service findings. If at any time the customer wants to continue with an upsell opportunity or requests a price quote, let them know you will transfer them to someone in the scheduling department to better assist them. If the customer wants to get off the phone, ask if there is a better time or person to call in the future.`,
      voice: 'echo',
      turn_detection: { type: 'server_vad' },
      input_audio_transcription: { model: 'whisper-1' },
    })

    await client.connect()

    client.sendUserMessageContent([
      {
        type: 'input_text',
        text: `Here's the technician note for this customer: ${technicianNote}. Please start the conversation with the customer based on this information.`,
      },
    ])

    client.createResponse()
  }
  return client
}

export async function POST(req) {
  const { technicianNote } = await req.json()
  const realtimeClient = await initializeClient(technicianNote)

  let initialResponse = ''

  await new Promise((resolve) => {
    realtimeClient.on('conversation.item.completed', ({ item }) => {
      if (item.role === 'assistant') {
        initialResponse = item.formatted.text
        resolve()
      }
    })
  })

  return NextResponse.json({ initialResponse })
}

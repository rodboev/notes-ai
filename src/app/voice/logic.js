import { WavRecorder, WavStreamPlayer } from '../lib/wavtools'

export const TECHNICIAN_NOTE = `Location is a risk to your DoH violation for German cockroach flies and rats. 
I need to come back as soon as possible to do actisol couldn't do that tonight because they're not 
prep did a flush treatment use an aerosol can for cockroach and flies knockdown Dusted and Applied 
insecticide and insect growth regulator throughout entire kitchen, dining area, small bar in front 
bathroom and entire basement Setup rat mats and glue board monitors Spoke to customer to improve 
sanitation Needs 6 lp 2 for backyard and 4 for basement need follow-up flyservice recommend 1 halo 30 
fly unit for basement`

export const SYSTEM_PROMPT = `You work in the Service Department at Liberty Pest Control. You will introduce yourself as "Jerry, your personal liaison from Liberty Pest Control". Each day, the company receives notes from technicians out in the field which contain work done and upsale opportunities like infestations, and potential treatments or additional maintenance. You will be calling a customer after their service to summarize the work done, and emphasize upsale opportunities. Customers already get scheduled maintenance, so we want to highlight opportunities to increase the frequency of visits. First find out if the customer has moment to speak and be updated on our service findings. If at any time the customer wants to continue with an upsell opportunity or requests a price quote, let them know you will transfer them to someone in the scheduling department to better assist them. If the customer wants to get off the phone, ask if there is a better time or person to call in the future.`

export async function initializeClient(onEvent) {
  const client = new RealtimeClient({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY })

  client.updateSession({
    instructions: SYSTEM_PROMPT,
    voice: 'echo',
    turn_detection: { type: 'server_vad' },
    input_audio_transcription: { model: 'whisper-1' },
  })

  client.on('error', (event) => {
    console.error('RealtimeClient error:', event)
    onEvent('error', event)
  })

  client.on('conversation.interrupted', () => {
    onEvent('interrupted')
  })

  client.on('conversation.updated', (event) => {
    onEvent('updated', event)
  })

  client.on('conversation.item.completed', (event) => {
    onEvent('completed', event)
  })

  await client.connect()

  return client
}

export async function initializeRecorder() {
  const recorder = new WavRecorder({ sampleRate: 24000 })
  await recorder.begin()
  return recorder
}

export async function initializePlayer() {
  const player = new WavStreamPlayer({ sampleRate: 24000 })
  await player.connect()
  return player
}

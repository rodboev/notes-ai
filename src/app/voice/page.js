'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RealtimeClient } from '@openai/realtime-api-beta'
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools'
import { Zap, X, Mic, MicOff } from 'react-feather'

const ConnectButton = ({ onClick, isConnected, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-4 py-2 ${
        isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
      } flex items-center font-bold text-white ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {isConnected ? (
        <>
          Disconnect <X className="ml-2" />
        </>
      ) : (
        <>
          Connect <Zap className="ml-2" />
        </>
      )}
    </button>
  )
}

export const SYSTEM_PROMPT = `You work in the Service Department at Liberty Pest Control. You will 
introduce yourself as "Jerry, your personal liaison from Liberty Pest Control". Each day, the company 
receives notes from technicians out in the field which contain work done and upsale opportunities like 
infestations, and potential treatments or additional maintenance. You will be calling a customer after 
their service to summarize the work done, and emphasize upsale opportunities. Customers already get 
scheduled maintenance, so we want to highlight opportunities to increase the frequency of visits. First 
find out if the customer has moment to speak and be updated on our service findings. If at any time the 
customer wants to continue with an upsell opportunity or requests a price quote, let them know you will 
transfer them to someone in the scheduling department to better assist them. If the customer wants to get 
off the phone, ask if there is a better time or person to call in the future.`

export const TECHNICIAN_NOTE = `Location is a risk to your DoH violation for German cockroach flies and rats. I need to come back as soon as possible to do actisol couldn't do that tonight because they're not 
prep did a flush treatment use an aerosol can for cockroach and flies knockdown Dusted and Applied 
insecticide and insect growth regulator throughout entire kitchen, dining area, small bar in front 
bathroom and entire basement Setup rat mats and glue board monitors Spoke to customer to improve 
sanitation Needs 6 lp 2 for backyard and 4 for basement need follow-up flyservice recommend 1 halo 30 
fly unit for basement`

const LOCAL_RELAY_SERVER_URL = 'ws://localhost:49152'

export default function VoiceChat() {
  const [isConnected, setIsConnected] = useState(false)
  const [items, setItems] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [canPushToTalk, setCanPushToTalk] = useState(true)

  const wavRecorderRef = useRef(new WavRecorder({ sampleRate: 24000 }))
  const wavStreamPlayerRef = useRef(new WavStreamPlayer({ sampleRate: 24000 }))
  const clientRef = useRef(new RealtimeClient({ url: LOCAL_RELAY_SERVER_URL }))

  const connectConversation = useCallback(async () => {
    const client = clientRef.current
    const wavRecorder = wavRecorderRef.current
    const wavStreamPlayer = wavStreamPlayerRef.current

    setIsConnected(true)
    setItems(client.conversation.getItems())

    await wavRecorder.begin()
    await wavStreamPlayer.connect()

    await client.connect()
    client.sendUserMessageContent([
      {
        type: 'input_text',
        text: 'Hello!',
      },
    ])

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono))
    }
  }, [])

  const disconnectConversation = useCallback(async () => {
    setIsConnected(false)
    setItems([])

    const client = clientRef.current
    client.disconnect()

    const wavRecorder = wavRecorderRef.current
    await wavRecorder.end()

    const wavStreamPlayer = wavStreamPlayerRef.current
    await wavStreamPlayer.interrupt()
  }, [])

  const startRecording = async () => {
    setIsRecording(true)
    const client = clientRef.current
    const wavRecorder = wavRecorderRef.current
    const wavStreamPlayer = wavStreamPlayerRef.current
    const trackSampleOffset = await wavStreamPlayer.interrupt()
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset
      await client.cancelResponse(trackId, offset)
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono))
  }

  const stopRecording = async () => {
    setIsRecording(false)
    const client = clientRef.current
    const wavRecorder = wavRecorderRef.current
    await wavRecorder.pause()
    client.createResponse()
  }

  const changeTurnEndType = async (value) => {
    const client = clientRef.current
    const wavRecorder = wavRecorderRef.current
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause()
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    })
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono))
    }
    setCanPushToTalk(value === 'none')
  }

  useEffect(() => {
    const client = clientRef.current
    const wavStreamPlayer = wavStreamPlayerRef.current

    client.updateSession({ instructions: SYSTEM_PROMPT })
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } })

    client.on('error', (event) => console.error(event))
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt()
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset
        await client.cancelResponse(trackId, offset)
      }
    })
    client.on('conversation.updated', async ({ item, delta }) => {
      const items = client.conversation.getItems()
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id)
      }
      setItems(items)
    })

    setItems(client.conversation.getItems())

    return () => {
      client.reset()
    }
  }, [])

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-4 text-2xl font-bold">Liberty Pest Control Voice Assistant</h1>
      <div className="mb-4">
        <ConnectButton
          onClick={isConnected ? disconnectConversation : connectConversation}
          isConnected={isConnected}
          disabled={false}
        />
      </div>
      <div className="mb-4">
        <button
          onClick={() => changeTurnEndType(canPushToTalk ? 'server_vad' : 'none')}
          className="rounded bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-600"
        >
          {canPushToTalk ? 'Switch to VAD' : 'Switch to Manual'}
        </button>
      </div>
      {isConnected && canPushToTalk && (
        <div className="mb-4">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            className={`${
              isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
            } rounded px-4 py-2 font-bold text-white`}
          >
            {isRecording ? 'Release to Send' : 'Push to Talk'}
          </button>
        </div>
      )}
      <div className="h-96 overflow-y-auto border p-4">
        {items.map((item) => (
          <div
            key={item.id}
            className={`mb-2 ${item.role === 'assistant' ? 'text-blue-600' : 'text-green-600'}`}
          >
            <strong>{item.role === 'assistant' ? 'Jerry: ' : 'You: '}</strong>
            {item.formatted.transcript || item.formatted.text}
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { RealtimeClient } from '@openai/realtime-api-beta'
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools'
import { startAudioStream, stopAudioStream } from '@/app/voice/handler'

export default function VoiceChat() {
  const [conversation, setConversation] = useState([])
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [currentUserTranscription, setCurrentUserTranscription] = useState('')
  const [currentAssistantResponse, setCurrentAssistantResponse] = useState('')
  const clientRef = useRef(null)
  const recorderRef = useRef(null)
  const playerRef = useRef(null)

  useEffect(() => {
    initializeClient()
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect()
      }
    }
  }, [])

  const initializeClient = async () => {
    const client = new RealtimeClient({
      url: '/api/audio',
    })

    client.updateSession({
      instructions: `You work in the Service Department at Liberty Pest Control. You will introduce yourself as "Jerry, your personal liaison from Liberty Pest Control". Each day, the company receives notes from technicians out in the field which contain work done and upsale opportunities like infestations, and potential treatments or additional maintenance. You will be calling a customer after their service to summarize the work done, and emphasize upsale opportunities. Customers already get scheduled maintenance, so we want to highlight opportunities to increase the frequency of visits. First find out if the customer has moment to speak and be updated on our service findings. If at any time the customer wants to continue with an upsell opportunity or requests a price quote, let them know you will transfer them to someone in the scheduling department to better assist them. If the customer wants to get off the phone, ask if there is a better time or person to call in the future.`,
      voice: 'echo',
      turn_detection: { type: 'server_vad' },
      input_audio_transcription: { model: 'whisper-1' },
    })

    client.on('error', (event) => {
      console.error('RealtimeClient error:', event)
    })

    client.on('conversation.interrupted', () => {
      if (playerRef.current) {
        playerRef.current.interrupt()
      }
    })

    client.on('conversation.updated', ({ item, delta }) => {
      if (item.role === 'user' && delta && delta.transcript) {
        setCurrentUserTranscription((prev) => prev + delta.transcript)
      } else if (item.role === 'assistant' && delta && delta.content) {
        setCurrentAssistantResponse((prev) => prev + delta.content)
      }
      if (delta && delta.audio) {
        playerRef.current.add16BitPCM(delta.audio)
      }
    })

    client.on('conversation.item.completed', ({ item }) => {
      if (item.role === 'user') {
        setConversation((prev) => [...prev, { role: 'user', content: currentUserTranscription }])
        setCurrentUserTranscription('')
      } else if (item.role === 'assistant') {
        setConversation((prev) => [
          ...prev,
          { role: 'assistant', content: currentAssistantResponse },
        ])
        setCurrentAssistantResponse('')
      }
    })

    await client.connect()
    clientRef.current = client

    recorderRef.current = new WavRecorder({ sampleRate: 24000 })
    playerRef.current = new WavStreamPlayer({ sampleRate: 24000 })
    await playerRef.current.connect()

    // Initialize conversation with technician note
    const technicianNote = `Location is a risk to your DoH violation for German cockroach flies and rats. I need to come back as soon as possible to do actisol couldn't do that tonight because they're not prep did a flush treatment use an aerosol can for cockroach and flies knockdown Dusted and Applied insecticide and insect growth regulator throughout entire kitchen, dining area, small bar in front bathroom and entire basement Setup rat mats and glue board monitors Spoke to customer to improve sanitation Needs 6 lp 2 for backyard and 4 for basement need follow-up flyservice recommend 1 halo 30 fly unit for basement`
    client.sendUserMessageContent([
      {
        type: 'input_text',
        text: `Here's the technician note for this customer: ${technicianNote}. Please start the conversation with the customer based on this information.`,
      },
    ])
    client.createResponse()
  }

  const startSession = async () => {
    setIsSessionActive(true)
    await recorderRef.current.begin()
    await recorderRef.current.record((data) => {
      clientRef.current.appendInputAudio(data.mono)
    })
  }

  const endSession = async () => {
    setIsSessionActive(false)
    await recorderRef.current.pause()
    await recorderRef.current.end()
    clientRef.current.createResponse()
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-4 text-2xl font-bold">Liberty Pest Control Voice Assistant</h1>
      <div className="mb-4">
        <button
          className={`rounded px-4 py-2 ${isSessionActive ? 'bg-red-500' : 'bg-blue-500'} text-white`}
          onClick={isSessionActive ? endSession : startSession}
        >
          {isSessionActive ? 'End Session' : 'Start Session'}
        </button>
      </div>
      <div className="h-96 overflow-y-auto border p-4">
        {conversation.map((item, index) => (
          <div
            key={index}
            className={`mb-2 ${item.role === 'assistant' ? 'text-blue-600' : 'text-green-600'}`}
          >
            <strong>{item.role === 'assistant' ? 'Jerry: ' : 'You: '}</strong>
            {item.content}
          </div>
        ))}
        {currentUserTranscription && (
          <div className="mb-2 text-green-600">
            <strong>You: </strong>
            {currentUserTranscription}
          </div>
        )}
        {currentAssistantResponse && (
          <div className="mb-2 text-blue-600">
            <strong>Jerry: </strong>
            {currentAssistantResponse}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRealtimeClient } from '@/app/hooks/useRealtimeClient'
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools'
import { TECHNICIAN_NOTE } from '@/app/voice/consts'

export default function VoiceChat() {
  const { client, connect } = useRealtimeClient()
  const [conversation, setConversation] = useState([])
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [currentUserTranscription, setCurrentUserTranscription] = useState('')
  const [currentAssistantResponse, setCurrentAssistantResponse] = useState('')
  const recorderRef = useRef(null)
  const playerRef = useRef(null)

  useEffect(() => {
    if (client) {
      client.on('error', handleError)
      client.on('conversation.interrupted', handleInterrupted)
      client.on('conversation.updated', handleConversationUpdated)
      client.on('conversation.item.completed', handleConversationItemCompleted)

      connect().then(() => {
        initializeConversation()
      })
    }
  }, [client, connect])

  const handleError = (event) => {
    console.error('RealtimeClient error:', event)
  }

  const handleInterrupted = () => {
    if (playerRef.current) {
      playerRef.current.interrupt()
    }
  }

  const handleConversationUpdated = ({ item, delta }) => {
    if (item.role === 'user' && delta && delta.transcript) {
      setCurrentUserTranscription((prev) => prev + delta.transcript)
    } else if (item.role === 'assistant' && delta && delta.content) {
      setCurrentAssistantResponse((prev) => prev + delta.content)
    }
    if (delta && delta.audio && playerRef.current) {
      playerRef.current.add16BitPCM(delta.audio)
    }
  }

  const handleConversationItemCompleted = ({ item }) => {
    if (item.role === 'user') {
      setConversation((prev) => [...prev, { role: 'user', content: currentUserTranscription }])
      setCurrentUserTranscription('')
    } else if (item.role === 'assistant') {
      setConversation((prev) => [...prev, { role: 'assistant', content: currentAssistantResponse }])
      setCurrentAssistantResponse('')
    }
  }

  const initializeConversation = async () => {
    await client.sendUserMessageContent([
      {
        type: 'input_text',
        text: `Here's the technician note for this customer: ${TECHNICIAN_NOTE}. Please start the conversation with the customer based on this information.`,
      },
    ])
    await client.createResponse()
  }

  const startSession = async () => {
    setIsSessionActive(true)
    if (!playerRef.current) {
      playerRef.current = new WavStreamPlayer({ sampleRate: 24000 })
      await playerRef.current.connect()
    }
    if (!recorderRef.current) {
      recorderRef.current = new WavRecorder({ sampleRate: 24000 })
      await recorderRef.current.begin()
    }
    await recorderRef.current.record((data) => {
      if (client && client.isConnected()) {
        client.appendInputAudio(data.mono)
      }
    })
  }

  const endSession = async () => {
    setIsSessionActive(false)
    if (recorderRef.current) {
      await recorderRef.current.pause()
      await recorderRef.current.end()
      recorderRef.current = null
    }
    if (client && client.isConnected()) {
      client.createResponse()
    }
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

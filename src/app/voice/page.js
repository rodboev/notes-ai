'use client'

import { useState, useEffect, useRef } from 'react'
import {
  initializeClient,
  initializeRecorder,
  initializePlayer,
  TECHNICIAN_NOTE,
  SYSTEM_PROMPT,
} from './logic'

export default function VoiceChat() {
  const [conversation, setConversation] = useState([])
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [currentUserTranscription, setCurrentUserTranscription] = useState('')
  const [currentAssistantResponse, setCurrentAssistantResponse] = useState('')
  const clientRef = useRef(null)
  const recorderRef = useRef(null)
  const playerRef = useRef(null)

  useEffect(() => {
    const setup = async () => {
      clientRef.current = await initializeClient(handleEvent)
      recorderRef.current = await initializeRecorder()
      playerRef.current = await initializePlayer()

      // Send system prompt
      clientRef.current.sendUserMessageContent([
        {
          type: 'input_text',
          text: SYSTEM_PROMPT,
        },
      ])

      // Initialize conversation with technician note
      clientRef.current.sendUserMessageContent([
        {
          type: 'input_text',
          text: `Here's the technician note for this customer: ${TECHNICIAN_NOTE}. Please start the conversation with the customer based on this information.`,
        },
      ])
      clientRef.current.createResponse()
    }

    setup()

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect()
      }
    }
  }, [])

  const handleEvent = (type, event) => {
    switch (type) {
      case 'error':
        console.error('RealtimeClient error:', event)
        break
      case 'interrupted':
        if (playerRef.current) {
          playerRef.current.interrupt()
        }
        break
      case 'updated':
        handleUpdatedEvent(event)
        break
      case 'completed':
        handleCompletedEvent(event)
        break
    }
  }

  const handleUpdatedEvent = (event) => {
    const { item, delta } = event
    if (item.role === 'user' && delta && delta.transcript) {
      setCurrentUserTranscription((prev) => prev + delta.transcript)
    } else if (item.role === 'assistant' && delta && delta.content) {
      setCurrentAssistantResponse((prev) => prev + delta.content)
    }
    if (delta && delta.audio && playerRef.current) {
      playerRef.current.add16BitPCM(delta.audio)
    }
  }

  const handleCompletedEvent = (event) => {
    const { item } = event
    if (item.role === 'user') {
      setConversation((prev) => [...prev, { role: 'user', content: currentUserTranscription }])
      setCurrentUserTranscription('')
    } else if (item.role === 'assistant') {
      setConversation((prev) => [...prev, { role: 'assistant', content: currentAssistantResponse }])
      setCurrentAssistantResponse('')
    }
  }

  const startSession = async () => {
    setIsSessionActive(true)
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

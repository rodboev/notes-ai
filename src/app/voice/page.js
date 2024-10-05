'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { startAudioStream, stopAudioStream } from './voiceHandler'

export default function VoiceChat() {
  const [conversation, setConversation] = useState([])
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [currentUserTranscription, setCurrentUserTranscription] = useState('')
  const [currentAssistantResponse, setCurrentAssistantResponse] = useState('')
  const clientRef = useRef(null)

  useEffect(() => {
    initializeConversation()
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect()
      }
    }
  }, [])

  const initializeConversation = async () => {
    const technicianNote =
      "This is an example of a recent technician note: Use this updated technician note: Location is a risk to your DoH violation for German cockroach flies and rats. I need to come back as soon as possible to do actisol couldn't do that tonight because they're not prep did a flush treatment use an aerosol can for cockroach and flies knockdown Dusted and Applied insecticide and insect growth regulator throughout entire kitchen, dining area, small bar in front bathroom and entire basement Setup rat mats and glue board monitors Spoke to customer to improve sanitation Needs 6 lp 2 for backyard and 4 for basement need follow-up flyservice recommend 1 halo 30 fly unit for basement"

    try {
      const response = await axios.post('/api/audio/initialize', {
        technicianNote: technicianNote,
      })
      clientRef.current = response.data.client
      setUpEventListeners()
      setConversation([{ role: 'assistant', content: response.data.initialResponse }])
    } catch (error) {
      console.error('Error initializing conversation:', error)
    }
  }

  const setUpEventListeners = () => {
    clientRef.current.on('error', (event) => {
      console.error('RealtimeClient error:', event)
    })

    clientRef.current.on('conversation.interrupted', () => {
      // Stop audio playback if necessary
    })

    clientRef.current.on('conversation.updated', ({ item, delta }) => {
      if (item.role === 'user' && delta && delta.transcript) {
        setCurrentUserTranscription((prev) => prev + delta.transcript)
      } else if (item.role === 'assistant' && delta && delta.content) {
        setCurrentAssistantResponse((prev) => prev + delta.content)
      }
    })

    clientRef.current.on('conversation.item.completed', ({ item }) => {
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
  }

  const startSession = () => {
    setIsSessionActive(true)
    startAudioStream(handleAudioData)
  }

  const endSession = () => {
    setIsSessionActive(false)
    stopAudioStream()
    clientRef.current.createResponse()
  }

  const handleAudioData = (int16Array) => {
    clientRef.current.appendInputAudio(int16Array)
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

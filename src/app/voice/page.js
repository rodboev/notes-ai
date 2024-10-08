'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools'
import { instructions } from '@/app/voice/conversation_config'
import Nav from '../components/Nav'
import { Phone, PhoneOff, Check, X } from 'lucide-react'
import SpinnerIcon from '../components/Icons/SpinnerIcon'
import { useWebSocket } from 'next-ws/client'
import { RealtimeClient } from '@openai/realtime-api-beta'

const ConnectionIndicator = ({ isConnected, url, isAvailable }) => {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-gray-500">{url}</span>
      <div className={`flex items-center ${isAvailable ? 'text-green-500' : 'text-red-500'}`}>
        {isAvailable ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </div>
      <span>Available</span>
      <div className={`flex items-center ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
        {isConnected ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </div>
      <span>Connected</span>
    </div>
  )
}

class RelayRealtimeClient extends RealtimeClient {
  constructor(options) {
    super(options)
    this.ws = new WebSocket(options.url)
    this.ws.onmessage = this.handleMessage.bind(this)
    this.eventHandlers = {}
  }

  handleMessage(event) {
    const data = JSON.parse(event.data)
    if (this.eventHandlers[data.type]) {
      this.eventHandlers[data.type].forEach((handler) => handler(data))
    }
  }

  async send(type, event) {
    this.ws.send(JSON.stringify({ type, ...event }))
  }

  isConnected() {
    return this.ws.readyState === WebSocket.OPEN
  }

  on(eventType, handler) {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = []
    }
    this.eventHandlers[eventType].push(handler)
  }

  off(eventType, handler) {
    if (this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = this.eventHandlers[eventType].filter((h) => h !== handler)
    }
  }
}

export default function VoiceChat() {
  const ws = useWebSocket()
  const [relayServerUrl, setRelayServerUrl] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isServerAvailable, setIsServerAvailable] = useState(false)
  const [items, setItems] = useState([])
  const [isPending, setIsPending] = useState(false)
  const [wsStatus, setWsStatus] = useState('Initializing...')

  const clientRef = useRef(null)
  const wavRecorderRef = useRef(new WavRecorder({ sampleRate: 24000 }))
  const wavStreamPlayerRef = useRef(new WavStreamPlayer({ sampleRate: 24000 }))

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/ws`
    setRelayServerUrl(wsUrl)

    const checkServerAvailability = async () => {
      try {
        console.log('Checking server availability...')
        const response = await fetch('/api/ws')
        const data = await response.json()
        console.log('Server availability response:', data)
        setIsServerAvailable(true)
        setWsStatus(`Available (${data.count} clients connected)`)
      } catch (error) {
        console.error('Error checking server availability:', error)
        setIsServerAvailable(false)
        setWsStatus('Error: Unable to connect')
      }
    }

    checkServerAvailability()
    const intervalId = setInterval(checkServerAvailability, 60000)

    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!relayServerUrl) return

    clientRef.current = new RelayRealtimeClient({ url: relayServerUrl })
    const client = clientRef.current
    const wavStreamPlayer = wavStreamPlayerRef.current

    client.on('session.update', (event) => {
      console.log('Session updated:', event)
    })

    client.on('conversation.updated', async ({ item, delta }) => {
      setItems((prevItems) => {
        const existingItemIndex = prevItems.findIndex((i) => i.id === item.id)
        if (existingItemIndex !== -1) {
          const updatedItems = [...prevItems]
          updatedItems[existingItemIndex] = { ...updatedItems[existingItemIndex], ...item }
          return updatedItems
        } else {
          return [...prevItems, item]
        }
      })

      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id)
      }
    })

    client.on('error', (error) => {
      console.error('RealtimeClient error:', error)
      setWsStatus(`Error: ${error.message}`)
    })

    const checkConnection = () => {
      setIsConnected(client.isConnected())
    }

    const intervalId = setInterval(checkConnection, 5000)

    return () => {
      clearInterval(intervalId)
      client.ws.close()
    }
  }, [relayServerUrl])

  const connectConversation = useCallback(async () => {
    if (!clientRef.current || !clientRef.current.isConnected()) {
      console.error('RealtimeClient is not connected')
      return
    }

    setIsPending(true)
    const client = clientRef.current
    const wavRecorder = wavRecorderRef.current
    const wavStreamPlayer = wavStreamPlayerRef.current

    try {
      console.log('Connecting conversation...')
      await client.send('session.update', { instructions })
      await client.send('session.update', { voice: 'echo' })
      await client.send('session.update', { input_audio_transcription: { model: 'whisper-1' } })

      await wavRecorder.begin()
      await wavStreamPlayer.connect()

      client.send('conversation.item.create', { type: 'input_text', text: 'Hello!' })

      await wavRecorder.record(async (data) => {
        if (data.mono && data.mono.length > 0) {
          await client.send('input_audio_buffer.append', { audio: data.mono })
        }
      })

      await client.send('session.update', { turn_detection: { type: 'server_vad' } })

      console.log('Conversation connected successfully')
    } catch (error) {
      console.error('Error connecting conversation:', error)
      setWsStatus(`Error: ${error.message}`)
    } finally {
      setIsPending(false)
    }
  }, [])

  const disconnectConversation = useCallback(async () => {
    if (!clientRef.current) return

    setIsPending(true)
    try {
      const client = clientRef.current
      await client.disconnect()

      const wavRecorder = wavRecorderRef.current
      await wavRecorder.end()

      wavRecorderRef.current = new WavRecorder({ sampleRate: 24000 })

      const wavStreamPlayer = wavStreamPlayerRef.current
      await wavStreamPlayer.interrupt()

      setIsConnected(false)
      setItems([])
      console.log('Conversation disconnected successfully')
    } catch (error) {
      console.error('Error disconnecting conversation:', error)
      setWsStatus(`Error: ${error.message}`)
    } finally {
      setIsPending(false)
    }
  }, [])

  const changeTurnEndType = async (value) => {
    const client = clientRef.current
    const wavRecorder = wavRecorderRef.current
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause()
    }
    await client.send('session.update', {
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    })
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record(async (data) => {
        if (data.mono && data.mono.length > 0) {
          await client.send('input_audio_buffer.append', { audio: data.mono })
        }
      })
    }
  }

  return (
    <>
      <Nav />
      <div className="flex h-dvh max-w-full snap-y snap-mandatory flex-col items-center justify-center overflow-y-scroll pb-8 pt-20">
        <ConnectionIndicator
          isConnected={clientRef.current?.isConnected() || false}
          url={relayServerUrl}
          isAvailable={isServerAvailable}
        />
        <div>WebSocket Status: {wsStatus}</div>
        <div className="m-4 h-full w-1/2 min-w-96 overflow-y-auto border p-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`mb-2 ${item.role === 'assistant' ? 'text-blue-600' : 'text-green-600'}`}
            >
              <strong>{item.role === 'assistant' ? 'Jerry: ' : 'Alex: '}</strong>
              {item.formatted?.transcript || item.formatted?.text || ''}
            </div>
          ))}
        </div>
        <ConnectButton
          onClick={clientRef.current?.isConnected() ? disconnectConversation : connectConversation}
          isConnected={clientRef.current?.isConnected() || false}
          disabled={!isServerAvailable || isPending}
          isPending={isPending}
        />
      </div>
    </>
  )
}

const ConnectButton = ({ onClick, isConnected, disabled, isPending }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isPending}
      className={`rounded px-4 py-2 pr-5 ${
        isConnected ? 'bg-neutral-500 hover:bg-neutral-600' : 'hover:bg-teal-600 bg-teal-500'
      } flex items-center font-bold text-white ${disabled || isPending ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {isPending ? (
        <>
          <SpinnerIcon className="-m-1 mr-2 h-4 w-4" />
          <span>Starting...</span>
        </>
      ) : !isConnected ? (
        <>
          <Phone className="mr-3 h-4 w-4" />
          <span>Start call</span>
        </>
      ) : (
        <>
          <PhoneOff className="mr-2 h-4 w-4" />
          <span>End call</span>
        </>
      )}
    </button>
  )
}

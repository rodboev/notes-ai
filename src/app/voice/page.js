'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools'
import { instructions } from '@/app/voice/conversation_config'
import Nav from '../components/Nav'
import { Phone, PhoneOff, Check, X } from 'lucide-react'
import SpinnerIcon from '../components/Icons/SpinnerIcon'
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

class CustomRealtimeClient {
  constructor(options) {
    this.ws = new WebSocket(options.url)
    this.isConnected = false
    this.eventHandlers = {}
    this.messageQueue = []

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.isConnected = true
      this.processQueue()
      if (this.eventHandlers['ready']) {
        this.eventHandlers['ready'].forEach((handler) => handler())
      }
    }

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (this.eventHandlers[data.type]) {
        this.eventHandlers[data.type].forEach((handler) => handler(data))
      }
    }

    this.ws.onclose = () => {
      console.log('WebSocket disconnected')
      this.isConnected = false
    }
  }

  on(eventType, handler) {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = []
    }
    this.eventHandlers[eventType].push(handler)
  }

  async connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve()
      } else {
        this.on('ready', () => {
          this.send({ type: 'connect' })
          this.on('connected', () => {
            resolve()
          })
        })
        this.on('error', (error) => {
          reject(error)
        })
      }
    })
  }

  send(data) {
    if (this.isConnected) {
      this.ws.send(JSON.stringify(data))
    } else {
      this.messageQueue.push(data)
    }
  }

  processQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      this.ws.send(JSON.stringify(message))
    }
  }

  async updateSession(data) {
    this.send({ type: 'session.update', data })
  }

  async sendUserMessageContent(data) {
    this.send({ type: 'conversation.item.create', data })
  }

  async appendInputAudio(data) {
    this.send({ type: 'input_audio_buffer.append', data })
  }

  async cancelResponse(trackId, offset) {
    this.send({ type: 'response.cancel', trackId, offset })
  }

  reset() {
    this.ws.close()
  }
}

export default function VoiceChat() {
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

  const connectConversation = useCallback(async () => {
    if (!relayServerUrl) {
      console.error('WebSocket URL is not set')
      return
    }

    setIsPending(true)
    try {
      clientRef.current = new CustomRealtimeClient({ url: relayServerUrl })
      const client = clientRef.current
      const wavRecorder = wavRecorderRef.current
      const wavStreamPlayer = wavStreamPlayerRef.current

      client.on('conversation.interrupted', async () => {
        const trackSampleOffset = await wavStreamPlayer.interrupt()
        if (trackSampleOffset?.trackId) {
          const { trackId, offset } = trackSampleOffset
          await client.cancelResponse(trackId, offset)
        }
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

      console.log('Connecting conversation...')
      await client.connect()

      await client.updateSession({ instructions })
      await client.updateSession({ voice: 'echo' })
      await client.updateSession({ input_audio_transcription: { model: 'whisper-1' } })

      await wavRecorder.begin()
      await wavStreamPlayer.connect()

      client.sendUserMessageContent([{ type: 'input_text', text: 'Hello!' }])

      await wavRecorder.record((data) => client.appendInputAudio(data.mono))

      await client.updateSession({ turn_detection: { type: 'server_vad' } })

      setIsConnected(true)
      setWsStatus('Connected')
      console.log('Conversation connected successfully')
    } catch (error) {
      console.error('Error connecting conversation:', error)
      setWsStatus(`Error: ${error.message}`)
    } finally {
      setIsPending(false)
    }
  }, [relayServerUrl])

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
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    })
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono))
    }
  }

  return (
    <>
      <Nav />
      <div className="flex h-dvh max-w-full snap-y snap-mandatory flex-col items-center justify-center overflow-y-scroll pb-8 pt-20">
        <ConnectionIndicator
          isConnected={isConnected}
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
          onClick={isConnected ? disconnectConversation : connectConversation}
          isConnected={isConnected}
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

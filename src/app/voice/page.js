'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools'
import { instructions } from '@/app/voice/conversation_config'
import Nav from '../components/Nav'
import { Phone, PhoneOff, Check, X } from 'lucide-react'
import SpinnerIcon from '../components/Icons/SpinnerIcon'
import { useWebSocket } from 'next-ws/client'

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

export default function VoiceChat() {
  const ws = useWebSocket()
  const [relayServerUrl, setRelayServerUrl] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isServerAvailable, setIsServerAvailable] = useState(false)
  const [items, setItems] = useState([])
  const [isPending, setIsPending] = useState(false)
  const [wsReady, setWsReady] = useState(false)

  const [wsStatus, setWsStatus] = useState('Initializing...')
  const wsRef = useRef(null)

  const wavRecorderRef = useRef(new WavRecorder({ sampleRate: 24000 }))
  const wavStreamPlayerRef = useRef(new WavStreamPlayer({ sampleRate: 24000 }))

  const [clientConnected, setClientConnected] = useState(false)

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
    if (!ws) return

    console.log('WebSocket connection opened')
    setIsConnected(true)
    setWsStatus('Connected')
    setWsReady(true)

    ws.onclose = () => {
      console.log('WebSocket connection closed')
      setIsConnected(false)
      setWsStatus('Disconnected')
      setWsReady(false)
      setClientConnected(false)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setWsStatus(`Error: ${error.message}`)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('Received message from server:', data)
      switch (data.type) {
        case 'connected':
          setClientConnected(true)
          break
        case 'conversation.updated':
          handleConversationUpdate(data)
          break
        case 'conversation.interrupted':
          // Handle interruption if needed
          break
        case 'error':
          console.error('Error from server:', data.message)
          setWsStatus(`Error: ${data.message}`)
          break
        default:
          console.warn(`Unhandled message type: ${data.type}`)
      }
    }

    return () => {
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
    }
  }, [ws])

  const handleConversationUpdate = useCallback(({ item, delta }) => {
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
      wavStreamPlayerRef.current.add16BitPCM(delta.audio, item.id)
    }
  }, [])

  const connectConversation = useCallback(async () => {
    if (!wsReady) {
      console.error('WebSocket is not ready')
      return
    }

    setIsPending(true)
    const wavRecorder = wavRecorderRef.current
    const wavStreamPlayer = wavStreamPlayerRef.current

    try {
      console.log('Connecting conversation...')
      ws.send(JSON.stringify({ type: 'connect' }))

      await wavRecorder.begin()
      await wavStreamPlayer.connect()

      ws.send(
        JSON.stringify({
          type: 'updateSession',
          data: { instructions, voice: 'echo', input_audio_transcription: { model: 'whisper-1' } },
        }),
      )

      ws.send(
        JSON.stringify({
          type: 'sendUserMessageContent',
          data: [{ type: 'input_text', text: 'Hello!' }],
        }),
      )

      await wavRecorder.record((data) => {
        ws.send(JSON.stringify({ type: 'appendInputAudio', data: data.mono }))
      })

      await changeTurnEndType('server_vad')
      console.log('Conversation connected successfully')
    } catch (error) {
      console.error('Error connecting conversation:', error)
      setWsStatus(`Error: ${error.message}`)
      setClientConnected(false)
    } finally {
      setIsPending(false)
    }
  }, [ws, wsReady])

  const disconnectConversation = useCallback(async () => {
    setIsPending(true)
    try {
      ws.send(JSON.stringify({ type: 'disconnect' }))

      const wavRecorder = wavRecorderRef.current
      await wavRecorder.end()

      wavRecorderRef.current = new WavRecorder({ sampleRate: 24000 })

      const wavStreamPlayer = wavStreamPlayerRef.current
      await wavStreamPlayer.interrupt()

      setClientConnected(false)
      setItems([])
      console.log('Conversation disconnected successfully')
    } catch (error) {
      console.error('Error disconnecting conversation:', error)
      setWsStatus(`Error: ${error.message}`)
    } finally {
      setIsPending(false)
    }
  }, [ws])

  const changeTurnEndType = async (value) => {
    const wavRecorder = wavRecorderRef.current
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause()
    }
    ws.send(
      JSON.stringify({
        type: 'updateSession',
        data: { turn_detection: value === 'none' ? null : { type: 'server_vad' } },
      }),
    )
    if (value === 'server_vad' && clientConnected) {
      await wavRecorder.record((data) => {
        ws.send(JSON.stringify({ type: 'appendInputAudio', data: data.mono }))
      })
    }
  }

  return (
    <>
      <Nav />
      <div className="flex h-dvh max-w-full snap-y snap-mandatory flex-col items-center justify-center overflow-y-scroll pb-8 pt-20">
        <ConnectionIndicator
          isConnected={clientConnected}
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
          onClick={clientConnected ? disconnectConversation : connectConversation}
          isConnected={clientConnected}
          disabled={!wsReady || !isServerAvailable || isPending}
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

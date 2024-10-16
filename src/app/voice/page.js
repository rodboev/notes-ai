'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools'
import { instructions } from '@/app/voice/conversation_config'
import Nav from '../components/Nav'
import { Phone, PhoneOff, Check, X } from 'lucide-react'
import SpinnerIcon from '../components/Icons/SpinnerIcon'
import { RealtimeClient } from '@openai/realtime-api-beta'
import CallButton from '../components/CallButton'

const ConnectionIndicator = ({ url, wsStatus }) => {
  const isAvailable = !wsStatus.includes('Unable') && !wsStatus.includes('Error')

  return (
    <>
      <div className={`flex items-center ${isAvailable ? 'text-green-500' : 'text-red-500'}`}>
        {isAvailable ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </div>
      <div>{[url, wsStatus].join(': ')}</div>
    </>
  )
}

const getWsUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost/api/ws'

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host // This includes the port if it's not the default
  return `${protocol}//${host}/api/ws`
}

export default function VoiceChat() {
  const [relayServerUrl, setRelayServerUrl] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isServerAvailable, setIsServerAvailable] = useState(false)
  const [items, setItems] = useState([])
  const [isPending, setIsPending] = useState(false)
  const [wsStatus, setWsStatus] = useState('Initializing...')
  const [activeCallFingerprint, setActiveCallFingerprint] = useState(null)

  const clientRef = useRef(null)
  const wavRecorderRef = useRef(new WavRecorder({ sampleRate: 24000 }))
  const wavStreamPlayerRef = useRef(new WavStreamPlayer({ sampleRate: 24000 }))

  useEffect(() => {
    const checkServerAvailability = async () => {
      try {
        console.log('Checking server availability...')
        const response = await fetch('/api/ws')
        const data = await response.json()
        console.log('Server availability response:', data)
        setIsServerAvailable(true)
        setWsStatus(`Available (${data.count} clients connected)`)
        setRelayServerUrl(getWsUrl())
      } catch (error) {
        console.error('Error checking server availability:', error)
        setIsServerAvailable(false)
        setWsStatus('Unable to connect to server')
      }
    }

    checkServerAvailability()
    const intervalId = setInterval(checkServerAvailability, 60000)

    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!relayServerUrl) return

    clientRef.current = new RealtimeClient({ url: relayServerUrl })
    const client = clientRef.current
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
        if (existingItemIndex === -1) return [...prevItems, item]

        // Create a new array with the updated item
        return prevItems.map((i) => (i.id === item.id ? { ...i, ...item } : i))
      })

      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id)
      }
    })

    client.on('error', (error) => {
      console.error('RealtimeClient error:', error)
      setWsStatus(error.message)
    })

    client.on('ready', () => {
      setIsConnected(true)
      setWsStatus('Connected')
      setItems(client.conversation.getItems())
    })

    client.on('close', () => {
      setIsConnected(false)
      setWsStatus('Disconnected')
    })

    return () => {
      client.reset()
    }
  }, [relayServerUrl])

  const handleConnectConversation = useCallback(async (note = null) => {
    if (!clientRef.current) {
      console.error('RealtimeClient is not initialized')
      setWsStatus('Error: RealtimeClient is not initialized')
      return
    }

    setIsPending(true)
    setWsStatus('Connecting...')
    const client = clientRef.current
    const wavRecorder = wavRecorderRef.current
    const wavStreamPlayer = wavStreamPlayerRef.current

    try {
      console.log('Connecting conversation...')
      await client.connect()

      await client.updateSession({ instructions })
      await client.updateSession({ voice: 'shimmer' })
      await client.updateSession({ input_audio_transcription: { model: 'whisper-1' } })

      await wavRecorder.begin()
      await wavStreamPlayer.connect()

      client.sendUserMessageContent([{ type: 'input_text', text: 'Hello!' }])

      if (client.getTurnDetectionType() === 'server_vad') {
        await wavRecorder.record((data) => client.appendInputAudio(data.mono))
      }

      await changeTurnEndType('server_vad')
      console.log('Conversation connected successfully')
      setWsStatus('Connected')
      setActiveCallFingerprint(note ? note.fingerprint : 'default')
    } catch (error) {
      console.error('Error connecting conversation:', error)
      setWsStatus(`Error: ${error.message}`)
    } finally {
      setIsPending(false)
    }
  }, [])

  const handleDisconnectConversation = useCallback(async () => {
    if (!clientRef.current) return

    setIsPending(true)
    setWsStatus('Disconnecting...')
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
      setWsStatus('Disconnected')
      setActiveCallFingerprint(null)
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
      <ConnectionIndicator className="indicator" url={relayServerUrl} wsStatus={wsStatus} />
      <div className="transcription m-4 h-full w-1/2 min-w-96 overflow-y-auto border p-4">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              className={`mb-2 ${item.role === 'assistant' ? 'text-blue-600' : 'text-green-600'}`}
            >
              <strong>{item.role === 'assistant' ? 'Jerry: ' : 'Alex: '}</strong>
              {item.formatted?.transcript || item.formatted?.text || ''}
            </div>
          ))
        ) : (
          <>
            <div class="space-y-2">
              <p className="italic text-neutral-500">Waiting for customer to start speaking...</p>
              <SpinnerIcon className="text-neutral-500" />
            </div>
          </>
        )}
      </div>
      <CallButton
        note={{ fingerprint: 'default' }}
        activeCallFingerprint={activeCallFingerprint}
        isPending={isPending}
        isResponding={false}
        connectConversation={handleConnectConversation}
        disconnectConversation={handleDisconnectConversation}
        cancelResponse={() => {}}
      />
    </>
  )
}

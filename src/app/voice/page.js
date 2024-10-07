'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RealtimeClient } from '@openai/realtime-api-beta'
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools'
import { instructions } from '@/app/voice/conversation_config'
import Nav from '../components/Nav'
import { Phone, PhoneOff } from 'lucide-react'
import SpinnerIcon from '../components/Icons/SpinnerIcon'

// Move the relayServerUrl logic inside the component
export default function VoiceChat() {
  const [relayServerUrl, setRelayServerUrl] = useState('')

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = process.env.NEXT_PUBLIC_RELAY_SERVER_PORT || '49152'
    const url = `${protocol}//${host}:${port}`
    setRelayServerUrl(url)
    console.log('Relay Server URL:', url)
  }, [])

  const [isConnected, setIsConnected] = useState(false)
  const [items, setItems] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [canPushToTalk, setCanPushToTalk] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])

  const wavRecorderRef = useRef(new WavRecorder({ sampleRate: 24000 }))
  const wavStreamPlayerRef = useRef(new WavStreamPlayer({ sampleRate: 24000 }))
  const clientRef = useRef(null)

  useEffect(() => {
    if (!relayServerUrl) return // Don't initialize if URL is not set yet

    clientRef.current = new RealtimeClient({ url: relayServerUrl })

    const client = clientRef.current
    const wavStreamPlayer = wavStreamPlayerRef.current

    client.updateSession({ instructions })
    client.updateSession({ voice: 'echo' })
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
  }, [relayServerUrl])

  const connectConversation = useCallback(async () => {
    if (!clientRef.current || !relayServerUrl) {
      console.error('RealtimeClient not initialized or relayServerUrl not set')
      setError('RealtimeClient not initialized or relayServerUrl not set')
      return
    }

    console.log('Starting connection...')
    console.log('RELAY_SERVER_URL:', relayServerUrl)
    setIsPending(true)
    const client = clientRef.current
    const wavRecorder = wavRecorderRef.current
    const wavStreamPlayer = wavStreamPlayerRef.current

    try {
      console.log('Attempting to connect client...')
      await client.connect()
      console.log('Client connected successfully')
      setIsConnected(true)
      setItems(client.conversation.getItems())

      console.log('Initializing wavRecorder...')
      await wavRecorder.begin()
      console.log('WavRecorder initialized')

      console.log('Connecting wavStreamPlayer...')
      await wavStreamPlayer.connect()
      console.log('WavStreamPlayer connected')

      console.log('Sending initial message...')
      client.sendUserMessageContent([
        {
          type: 'input_text',
          text: 'Hello!',
        },
      ])

      if (client.getTurnDetectionType() === 'server_vad') {
        console.log('Setting up audio recording...')
        await wavRecorder.record((data) => client.appendInputAudio(data.mono))
      }

      console.log('Changing turn end type...')
      await changeTurnEndType('server_vad')
      console.log('Connection process completed')
    } catch (error) {
      console.error('Error in connectConversation:', error)
      setError(error.message)
    } finally {
      setIsPending(false)
      console.log('Connection attempt finished')
    }
  }, [relayServerUrl])

  const disconnectConversation = useCallback(async () => {
    setIsConnected(false)
    setItems([])

    const client = clientRef.current
    client.disconnect()

    const wavRecorder = wavRecorderRef.current
    await wavRecorder.end()

    // Reset the WavRecorder
    wavRecorderRef.current = new WavRecorder({ sampleRate: 24000 })

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

  const log = (message) => {
    setLogs((prevLogs) => [...prevLogs, `${new Date().toISOString()}: ${message}`])
    console.log(message)
  }

  return (
    <>
      <Nav />
      <div className="flex h-dvh max-w-full snap-y snap-mandatory flex-col items-center justify-center overflow-y-scroll pb-8 pt-20">
        <div className="m-4 h-full w-1/2 min-w-96 overflow-y-auto border p-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`mb-2 ${item.role === 'assistant' ? 'text-blue-600' : 'text-green-600'}`}
            >
              <strong>{item.role === 'assistant' ? 'Jerry: ' : 'Alex: '}</strong>
              {item.formatted.transcript || item.formatted.text}
            </div>
          ))}
        </div>
        <ConnectButton
          onClick={isConnected ? disconnectConversation : connectConversation}
          isConnected={isConnected}
          disabled={false}
          isPending={isPending}
        />
        {error ||
          (logs.length > 0 && (
            <div className="p-4 text-xs">
              <ul>{error && <div className="mt-2 text-red-500">Error: {error}</div>}</ul>
              <ul>
                {logs.slice(-5).map((log, index) => (
                  <li key={index}>{log}</li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </>
  )
}

// Keep the ConnectButton component as is
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

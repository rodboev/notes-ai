import { useState, useCallback, useRef, useEffect } from 'react'
import { RealtimeClient } from '@openai/realtime-api-beta'
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools'
import { getPrompt } from '@/app/utils/voicePrompt'

const getWsUrl = () =>
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`
    : 'ws://localhost/api/ws'

let activeClientRef = null
let activeCall = null
const subscribers = new Set()

const notifySubscribers = () => {
  subscribers.forEach((callback) => callback())
}

export const useVoice = () => {
  const [isCallConnected, setIsCallConnected] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const clientRef = useRef(null)
  const wavRecorderRef = useRef(new WavRecorder({ sampleRate: 24000 }))
  const wavStreamPlayerRef = useRef(new WavStreamPlayer({ sampleRate: 24000 }))

  const connectConversation = useCallback(async (note) => {
    if (activeClientRef) {
      // Disconnect the active call before starting a new one
      await activeClientRef.disconnect()
      activeClientRef = null
      activeCall = null
      notifySubscribers()
    }

    if (clientRef.current) return
    setIsPending(true)
    try {
      const client = new RealtimeClient({ url: getWsUrl() })
      clientRef.current = client
      activeClientRef = client
      activeCall = note.fingerprint
      const wavRecorder = wavRecorderRef.current
      const wavStreamPlayer = wavStreamPlayerRef.current

      const instructions = getPrompt(note.content)

      await client.connect()
      await client.updateSession({ instructions })
      await client.updateSession({ voice: 'shimmer' })
      await client.updateSession({ input_audio_transcription: { model: 'whisper-1' } })

      await wavRecorder.begin()
      await wavStreamPlayer.connect()

      client.sendUserMessageContent([{ type: 'input_text', text: 'Hello!' }])

      client.updateSession({
        turn_detection: { type: 'server_vad' },
      })

      client.on('conversation.updated', async ({ item, delta }) => {
        if (delta?.audio) {
          wavStreamPlayer.add16BitPCM(delta.audio, item.id)
        }
      })

      // Start recording and sending audio
      await wavRecorder.record((data) => {
        if (client.isConnected()) {
          client.appendInputAudio(data.mono)
        }
      })

      setIsCallConnected(true)
      notifySubscribers()
    } catch (error) {
      console.error('Error connecting conversation:', error)
    } finally {
      setIsPending(false)
    }
  }, [])

  const disconnectConversation = useCallback(async () => {
    if (!clientRef.current) return
    setIsPending(true)
    try {
      await clientRef.current.disconnect()
      await wavRecorderRef.current.end()
      await wavStreamPlayerRef.current.interrupt()
      clientRef.current = null
      activeClientRef = null
      activeCall = null
      wavRecorderRef.current = new WavRecorder({ sampleRate: 24000 })
      setIsCallConnected(false)
      notifySubscribers()
    } catch (error) {
      console.error('Error disconnecting conversation:', error)
    } finally {
      setIsPending(false)
    }
  }, [])

  useEffect(() => {
    const updateConnectionStatus = () => {
      setIsCallConnected(!!activeCall)
    }

    subscribers.add(updateConnectionStatus)
    updateConnectionStatus()

    return () => {
      subscribers.delete(updateConnectionStatus)
      if (clientRef.current) {
        clientRef.current.reset()
        activeClientRef = null
        activeCall = null
        notifySubscribers()
      }
    }
  }, [])

  return {
    isCallConnected,
    isPending,
    activeCall,
    connectConversation,
    disconnectConversation,
  }
}

import { useState, useCallback, useRef, useEffect } from 'react'
import { RealtimeClient } from '@openai/realtime-api-beta'
import { WavRecorder, WavStreamPlayer } from '@/lib/wavtools'
import { getPrompt } from '@/utils/voicePrompt'
import { getWsUrl } from '@/utils/voice'

let activeClientRef = null
let activeCall = null
const subscribers = new Set()

const notifySubscribers = () => {
  for (const callback of subscribers) callback()
}

export const useVoice = () => {
  const [activeCallFingerprint, setActiveCallFingerprint] = useState(null)
  const [isPending, setIsPending] = useState(false)
  const [isResponding, setIsResponding] = useState(false)
  const clientRef = useRef(null)
  const wavRecorderRef = useRef(new WavRecorder({ sampleRate: 24000 }))
  const wavStreamPlayerRef = useRef(new WavStreamPlayer({ sampleRate: 24000 }))
  const lastResponseIdRef = useRef(null)

  const disconnectCurrentCall = useCallback(async () => {
    if (activeClientRef) {
      await activeClientRef.disconnect()
      await wavRecorderRef.current.end()
      await wavStreamPlayerRef.current.interrupt()
      activeClientRef = null
      activeCall = null
      setActiveCallFingerprint(null)
      setIsResponding(false)
      notifySubscribers()
    }
  }, [])

  const cancelResponse = useCallback(() => {
    if (clientRef.current && isResponding) {
      clientRef.current.sendEvent({
        type: 'response.cancel',
        event_id: `cancel_${Date.now()}`,
      })
      setIsResponding(false)
    }
  }, [isResponding])

  const connectConversation = useCallback(
    async (note) => {
      setIsPending(true)
      try {
        // Disconnect the current call if there is one
        await disconnectCurrentCall()

        const client = new RealtimeClient({ url: getWsUrl() })
        clientRef.current = client
        activeClientRef = client
        activeCall = note.fingerprint

        const instructions = getPrompt(note.content)

        await client.connect()
        await client.updateSession({ instructions })
        await client.updateSession({ voice: 'shimmer' })
        await client.updateSession({ input_audio_transcription: { model: 'whisper-1' } })

        await wavRecorderRef.current.begin()
        await wavStreamPlayerRef.current.connect()

        client.sendUserMessageContent([{ type: 'input_text', text: 'Hello!' }])

        client.updateSession({
          turn_detection: { type: 'server_vad' },
        })

        client.on('conversation.updated', async ({ item, delta }) => {
          if (delta?.audio) {
            wavStreamPlayerRef.current.add16BitPCM(delta.audio, item.id)
            setIsResponding(true)
            lastResponseIdRef.current = item.id
          }
        })

        client.on('turn.start', () => {
          cancelResponse()
        })

        client.on('turn.end', () => {
          setIsResponding(false)
          if (lastResponseIdRef.current) {
            client.sendEvent({
              type: 'conversation.item.truncate',
              item_id: lastResponseIdRef.current,
            })
            lastResponseIdRef.current = null
          }
        })

        // Start recording and sending audio
        await wavRecorderRef.current.record((data) => {
          if (client.isConnected()) {
            client.appendInputAudio(data.mono)
          }
        })

        setActiveCallFingerprint(note.fingerprint)
        notifySubscribers()
      } catch (error) {
        console.error('Error connecting conversation:', error)
      } finally {
        setIsPending(false)
      }
    },
    [disconnectCurrentCall, cancelResponse],
  )

  const disconnectConversation = useCallback(async () => {
    setIsPending(true)
    try {
      await disconnectCurrentCall()
      wavRecorderRef.current = new WavRecorder({ sampleRate: 24000 })
    } catch (error) {
      console.error('Error disconnecting conversation:', error)
    } finally {
      setIsPending(false)
    }
  }, [disconnectCurrentCall])

  useEffect(() => {
    return () => {
      disconnectCurrentCall()
    }
  }, [disconnectCurrentCall])

  return {
    activeCallFingerprint,
    isPending,
    isResponding,
    connectConversation,
    disconnectConversation,
    cancelResponse,
  }
}

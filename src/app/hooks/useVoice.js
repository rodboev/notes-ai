import { useState, useCallback, useRef, useEffect } from 'react'
import { RealtimeClient } from '@openai/realtime-api-beta'
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools'
import { getPrompt } from '@/app/utils/voicePrompt'
import { getWsUrl } from '@/app/utils/voice'

let activeClientRef = null
let activeCall = null
const subscribers = new Set()

const notifySubscribers = () => {
  subscribers.forEach((callback) => callback())
}

export const useVoice = () => {
  const [activeCallFingerprint, setActiveCallFingerprint] = useState(null)
  const [isPending, setIsPending] = useState(false)
  const clientRef = useRef(null)
  const wavRecorderRef = useRef(new WavRecorder({ sampleRate: 24000 }))
  const wavStreamPlayerRef = useRef(new WavStreamPlayer({ sampleRate: 24000 }))

  const disconnectCurrentCall = useCallback(async () => {
    if (activeClientRef) {
      await activeClientRef.disconnect()
      await wavRecorderRef.current.end()
      await wavStreamPlayerRef.current.interrupt()
      activeClientRef = null
      activeCall = null
      setActiveCallFingerprint(null)
      notifySubscribers()
    }
  }, [])

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
    [disconnectCurrentCall],
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
    connectConversation,
    disconnectConversation,
  }
}

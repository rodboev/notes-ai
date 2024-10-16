import { useState, useCallback, useRef, useEffect } from 'react'
import { RealtimeClient } from '@openai/realtime-api-beta'
import { WavRecorder, WavStreamPlayer } from '@/app/lib/wavtools'
import { getPrompt } from '@/app/utils/voicePrompt'
import { getWsUrl } from '@/app/utils/voice'

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

  const connectConversation = useCallback(
    async (note) => {
      setIsPending(true)
      try {
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
        await client.updateSession({
          turn_detection: {
            type: 'server_vad',
            threshold: 0.8,
          },
        })

        await wavRecorderRef.current.begin()
        await wavStreamPlayerRef.current.connect()

        client.on('conversation.updated', async ({ item, delta }) => {
          if (delta?.audio) {
            wavStreamPlayerRef.current.add16BitPCM(delta.audio, item.id)
            setIsResponding(true)
            lastResponseIdRef.current = item.id
          }
        })

        client.on('input_audio_buffer.speech_started', () => {
          console.log('Speech started, canceling response')
          client.cancelResponse()
          setIsResponding(false)
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

        client.on('conversation.interrupted', async () => {
          console.log('Conversation interrupted, canceling response')
          const trackSampleOffset = await wavStreamPlayerRef.current.interrupt()
          if (trackSampleOffset?.trackId) {
            const { trackId, offset } = trackSampleOffset
            await client.cancelResponse(trackId, offset)
          }
          setIsResponding(false)
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

  const getActiveClient = useCallback(() => clientRef.current, [])

  return {
    activeCallFingerprint,
    isPending,
    isResponding,
    connectConversation,
    disconnectConversation,
    getActiveClient,
  }
}

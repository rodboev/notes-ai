import { useState, useEffect, useCallback } from 'react'
import { RealtimeClient } from '@openai/realtime-api-beta'
import { SYSTEM_PROMPT } from '../voice/consts'

export function useRealtimeClient() {
  const [client, setClient] = useState(null)
  const [ws, setWs] = useState(null)

  useEffect(() => {
    const socket = new WebSocket(`ws://${window.location.host}/api/audio`)

    socket.onopen = () => {
      console.log('WebSocket connection established')
      const newClient = new RealtimeClient({
        send: (event) => socket.send(JSON.stringify(event)),
      })

      newClient.updateSession({
        instructions: SYSTEM_PROMPT,
        voice: 'echo',
        turn_detection: { type: 'server_vad' },
        input_audio_transcription: { model: 'whisper-1' },
      })

      setClient(newClient)
      setWs(socket)
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (client) {
        client.realtime.receive(data.type, data)
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    socket.onclose = () => {
      console.log('WebSocket connection closed')
    }

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close()
      }
    }
  }, [])

  const connect = useCallback(async () => {
    if (client && !client.isConnected()) {
      await client.connect()
    }
  }, [client])

  return { client, connect }
}

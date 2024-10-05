const floatTo16BitPCM = (float32Array) => {
  const buffer = new ArrayBuffer(float32Array.length * 2)
  const view = new DataView(buffer)
  let offset = 0
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

const base64EncodeAudio = (arrayBuffer) => {
  let binary = ''
  const bytes = new Uint8Array(arrayBuffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

let audioContext = null
let mediaStream = null
let scriptProcessor = null

export const startAudioStream = (onAudioData) => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 24000,
    })
  }

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      mediaStream = stream
      const source = audioContext.createMediaStreamSource(stream)
      scriptProcessor = audioContext.createScriptProcessor(2400, 1, 1)
      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

      scriptProcessor.onaudioprocess = (e) => {
        const float32Array = e.inputBuffer.getChannelData(0)
        const int16Array = new Int16Array(float32Array.length)
        for (let i = 0; i < float32Array.length; i++) {
          int16Array[i] = Math.max(-32768, Math.min(32767, Math.floor(float32Array[i] * 32768)))
        }
        onAudioData(int16Array)
      }
    })
    .catch((err) => console.error('Error accessing microphone:', err))
}

export const stopAudioStream = () => {
  if (scriptProcessor) {
    scriptProcessor.disconnect()
    scriptProcessor = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
}

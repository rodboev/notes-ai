import React from 'react'
import { Phone, PhoneOff, Mic } from 'lucide-react'
import SpinnerIcon from './Icons/SpinnerIcon'

const VoiceButton = ({
  note,
  activeCallFingerprint,
  isPending,
  isResponding,
  connectConversation,
  disconnectConversation,
  cancelResponse,
}) => {
  const isThisCallActive = activeCallFingerprint === note.fingerprint

  const handleClick = () => {
    if (isThisCallActive) {
      if (isResponding) {
        cancelResponse()
      } else {
        disconnectConversation()
      }
    } else {
      connectConversation(note)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`rounded px-4 py-2 ${
        isThisCallActive ? 'bg-neutral-500 hover:bg-neutral-600' : 'hover:bg-teal-600 bg-teal-500'
      } flex items-center font-bold text-white ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {isPending ? (
        <>
          <SpinnerIcon className="-m-1 mr-2 h-4 w-4" />
          <span>Starting...</span>
        </>
      ) : !isThisCallActive ? (
        <>
          <Phone className="mr-3 h-4 w-4" />
          <span>Start call</span>
        </>
      ) : isResponding ? (
        <>
          <Mic className="mr-2 h-4 w-4" />
          <span>Interrupt</span>
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

export default VoiceButton

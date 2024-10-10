import React from 'react'
import { Phone, PhoneOff } from 'lucide-react'
import SpinnerIcon from './Icons/SpinnerIcon'

const VoiceButton = ({
  note,
  activeCallFingerprint,
  isPending,
  connectConversation,
  disconnectConversation,
}) => {
  const isThisCallActive = activeCallFingerprint === note.fingerprint

  const handleClick = () => {
    if (isThisCallActive) {
      disconnectConversation()
    } else {
      connectConversation(note)
    }
  }

  return (
    <button
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

import React from 'react'
import { Phone, PhoneOff, X } from 'lucide-react'
import SpinnerIcon from './Icons/SpinnerIcon'

export default function CallButton({
  note,
  activeCallFingerprint,
  isPending,
  isResponding,
  connectConversation,
  disconnectConversation,
}) {
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
      className={`btn-teal flex ${
        isThisCallActive ? 'bg-neutral-500 hover:bg-neutral-600' : 'hover:bg-teal-600 bg-teal-500'
      } ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}
      type="button"
    >
      {isPending ? (
        <>
          <SpinnerIcon className="-m-1 -mb-2 mr-2 h-4 w-4" />
          <span>Starting...</span>
        </>
      ) : !isThisCallActive ? (
        <>
          <Phone className="mr-3 h-4 w-4" />
          <span>Start call</span>
        </>
      ) : isResponding ? (
        <>
          <X className="mr-2 h-4 w-4" />
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

import React from 'react'
import { Phone, PhoneOff } from 'lucide-react'
import SpinnerIcon from './Icons/SpinnerIcon'

export default function CallButton({
  note,
  activeCallFingerprint,
  isPending,
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
      className={`btn-teal flex space-x-2 pr-3 ${
        isThisCallActive ? 'bg-neutral-500 hover:bg-neutral-600' : 'hover:bg-teal-600 bg-teal-500'
      } ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}
      type="button"
    >
      {isPending ? (
        <>
          <SpinnerIcon className="-m-1 -mb-2 h-5 w-5" />
          <span>Starting</span>
        </>
      ) : !isThisCallActive ? (
        <>
          <Phone className="-ml-0.5 mr-0.5 h-5 w-5" />
          <span>Start call</span>
        </>
      ) : (
        <>
          <PhoneOff className="-ml-0.5 mr-0.5 h-5 w-5" />
          <span>End call</span>
        </>
      )}
    </button>
  )
}

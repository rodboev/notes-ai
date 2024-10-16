// src/app/components/Email.js

import React, { useRef, useState, useEffect, useCallback } from 'react'
import Editor from './Editor'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import SendEmailButton from './SendEmailButton'
import FeedbackButton from './FeedbackButton'
import RefreshButton from './RefreshButton'
import { useSingleEmail } from '../hooks/useEmails'
import CallButton from './CallButton'
import { useVoice } from '../hooks/useVoice'
import Transcription from './Transcription'

const Email = ({
  initialEmail,
  noteFingerprint,
  note,
  index,
  total,
  scrollToNextPair,
  children,
  emailStatus,
  updateStatus,
}) => {
  const editorRef = useRef(null)
  const { data, isLoading, error, refreshEmail } = useSingleEmail(noteFingerprint)
  const [items, setItems] = useState([])

  const {
    activeCallFingerprint,
    isPending,
    isResponding,
    connectConversation,
    disconnectConversation,
    getActiveClient,
  } = useVoice()

  const handleConversationUpdated = useCallback(({ item, delta }) => {
    setItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex((i) => i.id === item.id)
      if (existingItemIndex === -1) return [...prevItems, item]
      return prevItems.map((i) => (i.id === item.id ? { ...i, ...item } : i))
    })
  }, [])

  useEffect(() => {
    let client = null
    if (activeCallFingerprint === note.fingerprint) {
      client = getActiveClient()
      if (client) {
        client.on('conversation.updated', handleConversationUpdated)
        setItems(client.conversation.getItems())
      }
    } else {
      setItems([])
    }

    return () => {
      if (client) {
        client.off('conversation.updated', handleConversationUpdated)
      }
    }
  }, [activeCallFingerprint, note.fingerprint, handleConversationUpdated, getActiveClient])

  const handleEmailSent = () => {
    if (index < total - 1) {
      setTimeout(() => {
        scrollToNextPair(index + 1)
      }, 100)
    }
  }

  // Use the email from useSingleEmail hook if available, otherwise fall back to initialEmail
  const email = data || initialEmail

  const showTranscription = activeCallFingerprint === note.fingerprint

  const renderEmailContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-64 items-center justify-center text-neutral-500">
          <SpinnerIcon />
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm sm:text-base">Error: {error.message}</p>
        </div>
      )
    }

    if (email?.error) {
      return (
        <div className="relative inline-flex min-w-full max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-4 py-8 text-neutral-500 sm:px-6 sm:py-10 md:px-8 md:py-12 lg:px-10 lg:py-14 xl:min-w-96">
          <RefreshButton onClick={refreshEmail} />
          <ExclamationTriangleIcon className="m-2 w-6 sm:m-3 sm:w-8 md:m-4 md:w-10" />
          <div className="text-center text-xs md:text-sm lg:text-base">{email.error}</div>
        </div>
      )
    }

    if (email?.subject && !email?.emailAddress) {
      return (
        <div className="-mt-4 inline-flex min-w-full max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-4 py-8 text-neutral-500 sm:min-w-96 sm:px-6 sm:py-10 md:px-8 md:py-12 lg:px-10 lg:py-14">
          <RefreshButton onClick={refreshEmail} />
          <ExclamationTriangleIcon className="m-2 w-6 sm:m-3 sm:w-8 md:m-4 md:w-10" />
          <div className="text-center text-sm sm:text-base">No email address found in PestPac.</div>
        </div>
      )
    }

    if (email?.emailAddress && email?.subject && email?.body) {
      return (
        <>
          <div className="email flex flex-col">
            <h2 className="mb-1 text-lg font-bold !leading-[1.2] tracking-tighter text-teal md:text-xl lg:text-2xl lg:tracking-tight xl:tracking-normal">
              {email.subject}
            </h2>
            <p className="text-xs text-gray-600 sm:text-sm md:text-base">
              To: {email.emailAddress.toLowerCase().replace(/,/g, ', ')}
            </p>
            <Editor email={email} emailStatus={emailStatus} editorRef={editorRef}>
              {!(emailStatus?.status === 'sending' || emailStatus?.status === 'success') && (
                <RefreshButton onClick={refreshEmail} />
              )}
            </Editor>
          </div>
        </>
      )
    }

    return null
  }

  const renderButtons = () => {
    return (
      <div className="buttons mt-4 flex flex-col items-start sm:flex-row sm:items-center sm:justify-between">
        <div className="mb-2 flex items-center space-x-2 sm:mb-0 sm:space-x-3">
          {!email?.error ? (
            <>
              <SendEmailButton
                fingerprint={noteFingerprint}
                subject={email?.subject}
                getEmailContent={() => editorRef.current?.getContent()}
                onEmailSent={handleEmailSent}
                updateStatus={updateStatus}
                emailStatus={emailStatus}
              />
              <CallButton
                note={note}
                activeCallFingerprint={activeCallFingerprint}
                isPending={isPending}
                isResponding={isResponding}
                connectConversation={connectConversation}
                disconnectConversation={disconnectConversation}
              />
            </>
          ) : null}
        </div>
        {!email?.error &&
          (!emailStatus ||
            (emailStatus?.status !== 'sending' && emailStatus?.status !== 'success')) && (
            <FeedbackButton
              note={email?.noteContent}
              subject={email?.subject}
              email={() => editorRef.current?.getContent()}
            />
          )}
      </div>
    )
  }

  return (
    <div className="right flex w-1/2 flex-col justify-center px-4 pt-20 sm:px-6 md:px-8 lg:px-10">
      {showTranscription ? <Transcription items={items} /> : renderEmailContent()}
      {renderButtons()}
    </div>
  )
}

export default Email

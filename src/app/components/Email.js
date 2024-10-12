// src/app/components/Email.js

import React, { useRef } from 'react'
import Editor from './Editor'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import SendEmailButton from './SendEmailButton'
import FeedbackButton from './FeedbackButton'
import RefreshButton from './RefreshButton'
import { useSingleEmail } from '../hooks/useEmails'
import VoiceButton from './VoiceButton'

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
  activeCallFingerprint,
  isPending,
  isResponding,
  connectConversation,
  disconnectConversation,
  cancelResponse,
}) => {
  const editorRef = useRef(null)
  const { data, isLoading, error, refreshEmail } = useSingleEmail(noteFingerprint)

  const handleEmailSent = () => {
    if (index < total - 1) {
      setTimeout(() => {
        scrollToNextPair(index + 1)
      }, 100)
    }
  }

  // Use the email from useSingleEmail hook if available, otherwise fall back to initialEmail
  const email = data || initialEmail

  return (
    <div className="right -mr-4 flex min-h-screen flex-1.4 flex-col justify-center pt-16">
      {children}
      <div className="email flex flex-col p-10 pr-4">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-neutral-500">
            <SpinnerIcon />
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center">
            <p>Error: {error.message}</p>
          </div>
        ) : (
          email && (
            <>
              {email.emailAddress && email.body ? (
                <>
                  {email.subject && (
                    <h2 className="mb-1 text-2xl font-bold text-teal">{email.subject}</h2>
                  )}
                  <p className="text-base text-gray-600">
                    To: {email.emailAddress.toLowerCase().replace(/,/g, ', ')}
                  </p>
                  <Editor email={email} emailStatus={emailStatus} editorRef={editorRef}>
                    {!(emailStatus?.status === 'sending' || emailStatus?.status === 'success') && (
                      <RefreshButton onClick={refreshEmail} />
                    )}
                    <div className="buttons mt-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <SendEmailButton
                          fingerprint={noteFingerprint}
                          subject={email.subject}
                          getEmailContent={() => editorRef.current?.getContent()}
                          onEmailSent={handleEmailSent}
                          updateStatus={updateStatus}
                          emailStatus={emailStatus}
                        />
                        <VoiceButton
                          note={note}
                          activeCallFingerprint={activeCallFingerprint}
                          isPending={isPending}
                          isResponding={isResponding}
                          connectConversation={connectConversation}
                          disconnectConversation={disconnectConversation}
                          cancelResponse={cancelResponse}
                        />
                      </div>
                      {(!emailStatus ||
                        (emailStatus.status !== 'sending' && emailStatus.status !== 'success')) && (
                        <FeedbackButton
                          note={email.noteContent}
                          subject={email.subject}
                          email={() => editorRef.current?.getContent()}
                        />
                      )}
                    </div>
                  </Editor>
                </>
              ) : email.error ? (
                <div className="relative -mt-4 inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
                  <RefreshButton onClick={refreshEmail} />
                  <ExclamationTriangleIcon className="m-4 w-10" />
                  <div>{email.error}</div>
                </div>
              ) : email.subject && !email.emailAddress ? (
                <div className="relative -mt-4 inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
                  <RefreshButton onClick={refreshEmail} />
                  <ExclamationTriangleIcon className="m-4 w-10" />
                  <div>No email address found in PestPac.</div>
                </div>
              ) : null}
            </>
          )
        )}
      </div>
    </div>
  )
}

export default Email

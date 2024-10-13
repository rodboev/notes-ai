// src/app/components/Email.js

import React, { useRef } from 'react'
import Editor from './Editor'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import SendEmailButton from './SendEmailButton'
import FeedbackButton from './FeedbackButton'
import RefreshButton from './RefreshButton'
import { useSingleEmail } from '../hooks/useEmails'
import CallButton from './CallButton'

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
    <div className="right flex min-h-screen w-1/2 flex-col justify-center px-4 pt-20 sm:max-h-full sm:px-6 md:px-8 lg:px-10">
      {children}
      <div className="email flex flex-col">
        {isLoading && (
          <div className="flex h-64 items-center justify-center text-neutral-500">
            <SpinnerIcon />
          </div>
        )}
        {error && (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm sm:text-base">Error: {error.message}</p>
          </div>
        )}
        {email?.emailAddress && email?.body && (
          <>
            {email.subject && (
              <h2 className="mb-1 text-xl font-bold text-teal sm:text-2xl">{email.subject}</h2>
            )}
            <p className="mb-2 text-sm text-gray-600 sm:mb-3 sm:text-base">
              To: {email.emailAddress.toLowerCase().replace(/,/g, ', ')}
            </p>
            <Editor email={email} emailStatus={emailStatus} editorRef={editorRef}>
              {!(emailStatus?.status === 'sending' || emailStatus?.status === 'success') && (
                <RefreshButton onClick={refreshEmail} />
              )}
              <div className="buttons mt-3 flex flex-col items-start justify-between sm:flex-row sm:items-center">
                <div className="mb-2 flex items-center space-x-2 sm:mb-0 sm:space-x-3">
                  <SendEmailButton
                    fingerprint={noteFingerprint}
                    subject={email.subject}
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
        )}
        {email?.error && (
          <div className="inline-flex min-w-full max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-4 py-8 text-neutral-500 sm:px-6 sm:py-10 md:px-8 md:py-12 lg:px-10 lg:py-14 xl:min-w-96">
            <RefreshButton onClick={refreshEmail} />
            <ExclamationTriangleIcon className="m-2 w-6 sm:m-3 sm:w-8 md:m-4 md:w-10" />
            <div className="text-center text-xs md:text-sm lg:text-base">{email.error}</div>
          </div>
        )}
        {email?.subject && !email?.emailAddress && (
          <div className="-mt-4 inline-flex min-w-full max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-4 py-8 text-neutral-500 sm:min-w-96 sm:px-6 sm:py-10 md:px-8 md:py-12 lg:px-10 lg:py-14">
            <RefreshButton onClick={refreshEmail} />
            <ExclamationTriangleIcon className="m-2 w-6 sm:m-3 sm:w-8 md:m-4 md:w-10" />
            <div className="text-center text-sm sm:text-base">
              No email address found in PestPac.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Email

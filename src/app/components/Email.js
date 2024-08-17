// src/app/components/Email.js

import React, { useRef } from 'react'
import EditableEmail from './EditableEmail'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import SendEmailButton from './SendEmailButton'
import FeedbackButton from './FeedbackButton'
import RefreshButton from './RefreshButton'
import { useSingleEmail } from '../hooks/useEmails'

const Email = ({
  initialEmail,
  noteFingerprint,
  emailStatus,
  updateStatus,
  index,
  total,
  scrollToNextPair,
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

  if (isLoading) {
    return (
      <div>
        <SpinnerIcon />
      </div>
    )
  }

  if (error) {
    console.warn(`Error: ${error.message}`)
    // return <div>Error: {error.message}</div>
  }

  // Use the email from useSingleEmail hook if available, otherwise fall back to initialEmail
  const email = data || initialEmail

  return (
    <div className="right -mr-4 flex min-h-screen flex-1.4 flex-col justify-center pt-16">
      <div className="email flex flex-col p-10 pr-4">
        {email ? (
          <>
            {email.emailAddress && email.subject && (
              <>
                <h2 className="mb-1 text-2xl font-bold text-teal">{email.subject}</h2>
                <p className="text-base text-gray-600">
                  To: {email.emailAddress.toLowerCase().replace(/,/g, ', ')}
                </p>
              </>
            )}
            {email.emailAddress && email.body ? (
              <>
                <EditableEmail email={email} emailStatus={emailStatus} editorRef={editorRef}>
                  {!(emailStatus?.status === 'sending' || emailStatus?.status === 'success') && (
                    <RefreshButton onClick={refreshEmail} />
                  )}
                  <div className="buttons mt-4 flex items-center justify-between">
                    <SendEmailButton
                      fingerprint={noteFingerprint}
                      subject={email.subject}
                      getEmailContent={() => editorRef.current?.getContent()}
                      onEmailSent={handleEmailSent}
                      updateStatus={updateStatus}
                    />
                    {(!emailStatus ||
                      (emailStatus.status !== 'sending' && emailStatus.status !== 'success')) && (
                      <FeedbackButton
                        note={email.noteContent}
                        subject={email.subject}
                        email={() => editorRef.current?.getContent()}
                      />
                    )}
                  </div>
                </EditableEmail>
              </>
            ) : email.error ? (
              <div className="relative -mt-4 inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
                <RefreshButton onClick={refreshEmail} />
                <ExclamationTriangleIcon className="m-4 w-10" />
                <div>{email.error}</div>
              </div>
            ) : (
              <div className="relative -mt-4 inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
                <RefreshButton onClick={refreshEmail} />
                <ExclamationTriangleIcon className="m-4 w-10" />
                <div>No email address found in PestPac.</div>
              </div>
            )}
          </>
        ) : (
          <div className="relative -mt-4 inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
            <RefreshButton onClick={refreshEmail} />
            <ExclamationTriangleIcon className="m-4 w-10" />
            <div>No email data available.</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Email

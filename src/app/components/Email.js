// src/app/components/Email.js

import React, { useRef } from 'react'
import EditableEmail from './EditableEmail'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import SendEmailButton from './SendEmailButton'
import FeedbackButton from './FeedbackButton'
import RefreshButton from './RefreshButton'
import { useEmailStatus } from '../hooks/useEmailStatus'
import { useSingleEmail } from '../hooks/useEmails'

const Email = ({
  email,
  noteFingerprint,
  emailStatus,
  updateStatus,
  index,
  total,
  scrollToNextPair,
}) => {
  const editorRef = useRef(null)
  const { data: emailData, refreshEmail } = useSingleEmail(noteFingerprint)

  const handleRefresh = async () => {
    const refreshedEmail = await refreshEmail()
    if (refreshedEmail && editorRef.current) {
      editorRef.current.setContent(refreshedEmail.body || '')
    }
  }

  const handleEmailSent = () => {
    if (index < total - 1) {
      setTimeout(() => {
        scrollToNextPair(index + 1)
      }, 100)
    }
  }

  const displayEmail = emailData || email

  return (
    <div className="right -mr-4 flex min-h-screen flex-1.4 flex-col justify-center pt-16">
      <div className="email flex flex-col p-10 pr-4">
        {displayEmail ? (
          <>
            {displayEmail.emailAddress && displayEmail.subject && (
              <>
                <h2 className="mb-1 text-2xl font-bold text-teal">{displayEmail.subject}</h2>
                <p className="text-base text-gray-600">
                  To: {displayEmail.emailAddress.toLowerCase().replace(/,/g, ', ')}
                </p>
              </>
            )}
            {displayEmail.emailAddress && displayEmail.body ? (
              <EditableEmail
                email={displayEmail}
                emailStatus={emailStatus}
                editorRef={editorRef}
                onRefresh={handleRefresh}
              >
                <SendEmailButton
                  fingerprint={noteFingerprint}
                  subject={displayEmail.subject}
                  getEmailContent={() => editorRef.current?.getContent()}
                  onEmailSent={handleEmailSent}
                  updateStatus={updateStatus}
                />
                {(!emailStatus ||
                  (emailStatus.status !== 'sending' && emailStatus.status !== 'success')) && (
                  <FeedbackButton
                    note={displayEmail.noteContent}
                    subject={displayEmail.subject}
                    email={() => editorRef.current?.getContent()}
                  />
                )}
              </EditableEmail>
            ) : displayEmail.error ? (
              <div className="relative -mt-4 inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
                <RefreshButton onClick={handleRefresh} />
                <ExclamationTriangleIcon className="m-4 w-10" />
                <div>{displayEmail.error}</div>
              </div>
            ) : (
              <div className="relative -mt-4 inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
                <RefreshButton onClick={handleRefresh} />
                <ExclamationTriangleIcon className="m-4 w-10" />
                <div>No email address found in PestPac.</div>
              </div>
            )}
          </>
        ) : (
          <div className="relative -mt-4 inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
            <RefreshButton onClick={handleRefresh} />
            <ExclamationTriangleIcon className="m-4 w-10" />
            <div>No email data available.</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Email

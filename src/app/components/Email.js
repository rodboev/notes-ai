// src/app/components/Email.js

import React, { useRef, useEffect } from 'react'
import EditableEmail from './EditableEmail'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import SendEmailButton from './SendEmailButton'
import FeedbackButton from './FeedbackButton'
import RefreshButton from './RefreshButton'
import { useEmailStatus } from '../hooks/useEmailStatus'

const Email = ({
  email,
  noteFingerprint,
  index,
  total,
  scrollToNextPair,
  fetchData,
  startDate,
  endDate,
}) => {
  const editorRef = useRef(null)
  const [emailStatuses, updateEmailStatus, isLoading, fetchStatuses] = useEmailStatus()

  const handleEmailSent = () => {
    if (index < total - 1) {
      setTimeout(() => {
        scrollToNextPair(index + 1)
      }, 100)
    }
  }

  const emailStatus = emailStatuses[email?.fingerprint] || {}

  const handleRefresh = () => {
    fetchData({
      fingerprint: email.fingerprint || noteFingerprint,
      startDate,
      endDate,
    })
  }

  return (
    <div className="right -mr-4 flex min-h-screen flex-1.4 flex-col justify-center pt-16">
      <div className="email flex flex-col p-10 pr-4">
        {email && !isLoading ? (
          <>
            {email.emailAddress && email.subject && (
              <>
                <h2 className="mb-1 text-2xl font-bold text-teal">{email.subject}</h2>
                <p className="text-base text-gray-600">
                  To:{' '}
                  {email?.emailAddress ? (
                    email.emailAddress.toLowerCase().replace(/,/g, ', ')
                  ) : (
                    <span className="mx-1 inline-block bg-red-800 px-12 py-1 text-sm font-bold text-white">
                      missing
                    </span>
                  )}
                </p>
              </>
            )}
            {email.emailAddress && email.body ? (
              <EditableEmail
                email={email}
                emailStatus={emailStatus}
                editorRef={editorRef}
                onRefresh={handleRefresh}
              >
                <SendEmailButton
                  fingerprint={email.fingerprint}
                  subject={email.subject}
                  getEmailContent={() => editorRef.current?.getContent()}
                  onEmailSent={handleEmailSent}
                  emailStatus={emailStatus}
                  updateEmailStatus={(newStatus) => updateEmailStatus(email.fingerprint, newStatus)}
                />
                {(!emailStatus.status ||
                  (emailStatus.status !== 'sending' && emailStatus.status !== 'success')) && (
                  <FeedbackButton
                    note={email.noteContent}
                    subject={email.subject}
                    email={editorRef.current?.getContent() || ''}
                  />
                )}
              </EditableEmail>
            ) : email.error ? (
              <div className="relative -mt-4 inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
                <RefreshButton onClick={handleRefresh} />
                <ExclamationTriangleIcon className="m-4 w-10" />
                <div>{email.error}</div>
              </div>
            ) : (
              typeof email.emailAddress === 'undefined' && (
                <div className="relative -mt-4 inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
                  <RefreshButton onClick={handleRefresh} />
                  <ExclamationTriangleIcon className="m-4 w-10" />
                  <div>No email address found in PestPac.</div>
                </div>
              )
            )}
          </>
        ) : (
          <div className="inline-flex flex-col items-center text-neutral-500">
            <SpinnerIcon className="scale-150 text-neutral-500" />
          </div>
        )}
      </div>
    </div>
  )
}

export default Email

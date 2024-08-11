// src/app/components/NoteEmailPair.js

import { usePersistedEmailStatus } from '../hooks/usePersistedEmailStatus'
import { useRef } from 'react'
import Note from './Note'
import EditableEmail from './EditableEmail'
import SendEmailButton from './SendEmailButton'
import FeedbackButton from './FeedbackButton'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import RefreshButton from './RefreshButton'

const NoteEmailPair = ({ note, email, index, total, onEmailSent, pairRefs, fetchData }) => {
  const [emailStatus, updateEmailStatus] = usePersistedEmailStatus(email?.fingerprint)
  const editorRef = useRef(null)

  return (
    <div
      ref={(el) => (pairRefs.current[index] = el)}
      className="container -m-4 flex max-w-screen-2xl snap-center snap-always p-4 pb-0"
    >
      <Note index={index} total={total}>
        <div className="text-3xl font-bold">{note.code?.split(' ')[0]}</div>
        <div className="text-xl font-bold">
          <a href={`https://app.pestpac.com/location/detail.asp?LocationID=${note.locationID}`}>
            {note.company} - {note.locationCode}
          </a>
        </div>
        <div className="content my-5">{note.content}</div>
        <div className="text-lg font-semibold">{note.tech}</div>
      </Note>
      <div className="right -mr-4 flex min-h-screen flex-1.4 flex-col justify-center pt-6">
        <div className="email flex flex-col p-10 pr-4">
          {email ? (
            <>
              {email.subject && (
                <h2 className="mb-2.5 text-2xl font-bold text-teal">{email.subject}</h2>
              )}
              {email.body ? (
                <EditableEmail
                  email={email}
                  emailStatus={emailStatus}
                  updateEmailStatus={updateEmailStatus}
                  editorRef={editorRef}
                  onRefresh={() => fetchData(email.fingerprint)}
                >
                  <SendEmailButton
                    fingerprint={email.fingerprint}
                    subject={email.subject}
                    getEmailContent={() => editorRef.current?.getContent()}
                    onEmailSent={() => {
                      updateEmailStatus({ status: 'success' })
                      onEmailSent(index, total)
                    }}
                    emailStatus={emailStatus}
                    updateEmailStatus={updateEmailStatus}
                  />
                  {emailStatus.status !== 'sending' && emailStatus.status !== 'success' && (
                    <FeedbackButton
                      note={note.content}
                      subject={email.subject}
                      email={editorRef.current?.getContent() || ''}
                    />
                  )}
                </EditableEmail>
              ) : (
                email.error && (
                  <div className="relative inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
                    <RefreshButton
                      onClick={() => fetchData(note.fingerprint)}
                      className="right-0 top-0"
                    />
                    <ExclamationTriangleIcon className="m-4 w-10" />
                    <div>{email?.error}</div>
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
    </div>
  )
}

export default NoteEmailPair

// src/app/page.js

'use client'

import { useEffect, useRef } from 'react'
import { useData } from './hooks/useData'
import { usePersistedEmailStatus } from './hooks/usePersistedEmailStatus'
import Nav from './components/Nav'
import Note from './components/Note'
import Email from './components/Email'
import UploadButton from './components/UploadButton'
import ClearButton from './components/ClearButton'
import Upload from './components/Upload'

export default function Home() {
  const { pairs, notesExist, fetchData, clearData, uploadData } = useData()
  const [emailStatuses, updateEmailStatus, isLoading] = usePersistedEmailStatus()
  const pairRefs = useRef([])

  useEffect(() => {
    fetchData()
  }, [])

  const handleEmailSent = (index, total) => {
    if (index < total - 1) {
      setTimeout(() => {
        pairRefs.current[index + 1]?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }

  const handleUpload = (data) => {
    uploadData(data, pairRefs)
  }

  return (
    <div className="flex h-screen max-w-full snap-y snap-mandatory flex-col items-center overflow-y-scroll">
      <Nav>
        <UploadButton onUpload={() => {}} pairRefs={pairRefs} />
        {notesExist && (
          <ClearButton fetchData={fetchData} onClear={clearData} pairRefs={pairRefs} />
        )}
      </Nav>

      <Upload onUpload={handleUpload} notesExist={notesExist} />

      {notesExist &&
        pairs.map(({ note, email }, index) => (
          <div
            key={note.fingerprint}
            ref={(el) => (pairRefs.current[index] = el)}
            className="pair container -m-4 flex max-w-screen-2xl snap-center snap-always p-4 pb-0"
          >
            <Note note={note} index={index} total={pairs.length} />
            <Email
              email={email}
              noteFingerprint={note.fingerprint}
              index={index}
              total={pairs.length}
              onEmailSent={handleEmailSent}
              fetchData={fetchData}
              emailStatus={emailStatuses[email?.fingerprint] || {}}
              updateEmailStatus={(newStatus) => updateEmailStatus(email?.fingerprint, newStatus)}
              isLoading={isLoading}
            />
          </div>
        ))}
    </div>
  )
}

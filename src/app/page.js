// src/app/page.js

'use client'

import { useEffect, useRef } from 'react'
import { useData } from './hooks/useData'
import Nav from './components/Nav'
import Note from './components/Note'
import Email from './components/Email'
import UploadButton from './components/UploadButton'
import ClearButton from './components/ClearButton'

export default function Home() {
  const { pairs, notesExist, fetchData, clearData, uploadData } = useData()
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

  return (
    <div className="flex h-screen max-w-full snap-y snap-mandatory flex-col items-center overflow-y-scroll">
      <Nav>
        <UploadButton onUpload={(data) => uploadData(data, pairRefs)} pairRefs={pairRefs} />
        {notesExist && (
          <ClearButton fetchData={fetchData} onClear={clearData} pairRefs={pairRefs} />
        )}
      </Nav>
      {notesExist ? (
        pairs.map(({ note, email }, index) => (
          <div
            key={note.fingerprint}
            className="container -m-4 flex max-w-screen-2xl snap-center snap-always p-4 pb-0"
          >
            <Note
              ref={(el) => (pairRefs.current[index] = el)}
              note={note}
              index={index}
              total={pairs.length}
            />
            <Email
              email={email}
              noteFingerprint={note.fingerprint}
              index={index}
              total={pairs.length}
              onEmailSent={handleEmailSent}
              fetchData={fetchData}
            />
          </div>
        ))
      ) : (
        <div className="flex h-full items-center justify-center">
          <p>No notes available. Please upload some data.</p>
        </div>
      )}
    </div>
  )
}

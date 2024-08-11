// src/app/page.js

'use client'

import { useEffect, useRef } from 'react'
import { useData } from './hooks/useData'
import Nav from './components/Nav'
import NoteEmailPair from './components/NoteEmailPair'
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
      {notesExist &&
        pairs.map(({ note, email }, index) => (
          <NoteEmailPair
            key={note.fingerprint}
            note={note}
            email={email}
            index={index}
            total={pairs.length}
            onEmailSent={handleEmailSent}
            pairRefs={pairRefs}
            fetchData={fetchData}
          />
        ))}
    </div>
  )
}

// src/app/page.js

'use client'

import { useEffect, useRef } from 'react'
import { useData } from './hooks/useData'
import Nav from './components/Nav'
import Note from './components/Note'
import Email from './components/Email'
import UploadButton from './components/UploadButton'
import ClearButton from './components/ClearButton'
import Upload from './components/Upload'

export default function Home() {
  const { pairs, notesExist, fetchData, clearData, uploadData } = useData()
  const pairRefs = useRef([])

  useEffect(() => {
    fetchData()
  }, [])

  const handleUpload = (data) => {
    uploadData(data, pairRefs)
  }

  const scrollToNextPair = (index) => {
    pairRefs.current[index]?.scrollIntoView({ behavior: 'smooth' })
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
              fetchData={fetchData}
              scrollToNextPair={scrollToNextPair}
            />
          </div>
        ))}
    </div>
  )
}

// src/app/page.js

'use client'

import { useState, useRef } from 'react'
import Nav from './components/Nav'
import Note from './components/Note'
import Email from './components/Email'
import Datepicker from 'react-tailwindcss-datepicker'
import { useNotes } from './hooks/useNotes'
import { useEmails } from './hooks/useEmails'
import { leftJoin } from './utils/arrayUtils'
import { useEmailStatuses } from './hooks/useEmailStatus'

export default function Home() {
  const pairRefs = useRef([])

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const [date, setDate] = useState({
    startDate: yesterday.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  })

  const {
    data: notes,
    isLoading: isLoadingNotes,
    error: notesError,
  } = useNotes(date.startDate, date.endDate)
  const { data: emails, isLoading: isLoadingEmails, error: emailsError } = useEmails(notes)
  const fingerprints = notes?.map((note) => note.fingerprint) || []
  const {
    data: emailStatuses,
    isLoading: isLoadingStatuses,
    updateStatus,
  } = useEmailStatuses(fingerprints)

  const handleDateChange = (newDate) => {
    console.log('newDate:', newDate)
    setDate(newDate)
  }

  const scrollToNextPair = (index) => {
    pairRefs.current[index]?.scrollIntoView({ behavior: 'smooth' })
  }

  // if (isLoadingNotes || isLoadingEmails) return <div>Loading...</div>
  if (notesError || emailsError)
    return <div>An error occurred: {notesError?.message || emailsError?.message}</div>

  const pairs = leftJoin(notes, emails?.emails || [])

  return (
    <div className="flex h-screen max-w-full snap-y snap-mandatory flex-col items-center overflow-y-scroll">
      <Nav>
        <Datepicker
          useRange={false}
          primaryColor={'teal'}
          placeholder={'Select date range'}
          separator={'-'}
          displayFormat={'M/D/YY'}
          inputClassName={
            'h-10 w-40 items-center overflow-hidden rounded px-3 pt-0.5 focus-visible:outline-none align-middle text-right cursor-pointer'
          }
          readOnly={true}
          containerClassName={'relative w-fit text-black border-color z-30'}
          toggleClassName={
            'h-10 w-fit items-center overflow-hidden rounded px-4 pb-0.5 font-bold hover:bg-opacity-95 active:bg-opacity-100 bg-teal text-white align-middle ml-4'
          }
          value={date}
          onChange={handleDateChange}
        />
      </Nav>

      {pairs.map(({ note, email }, index) => (
        <div
          key={note.fingerprint}
          ref={(el) => (pairRefs.current[index] = el)}
          className="pair container -m-4 flex max-w-screen-2xl snap-center snap-always p-4 pb-0"
        >
          <Note note={note} index={index} total={pairs.length} />
          <Email
            email={email}
            noteFingerprint={note.fingerprint}
            emailStatus={emailStatuses?.[note.fingerprint]}
            updateStatus={updateStatus}
            index={index}
            total={pairs.length}
            scrollToNextPair={scrollToNextPair}
          />
        </div>
      ))}
    </div>
  )
}

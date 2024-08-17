// src/app/page.js

'use client'

import { useState, useRef, useEffect } from 'react'
import Nav from './components/Nav'
import Note from './components/Note'
import Email from './components/Email'
import Datepicker from 'react-tailwindcss-datepicker'
import { useNotes } from './hooks/useNotes'
import { useEmails } from './hooks/useEmails'
import { useEmailStatuses } from './hooks/useEmailStatus'

const leftJoin = (notes, emails) => {
  if (!notes || !emails) return []
  return notes.map((note) => ({
    note,
    email: emails.find((email) => email?.fingerprint === note.fingerprint) || null,
  }))
}

export default function Home() {
  const pairRefs = useRef([])

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const [date, setDate] = useState({
    startDate: yesterday.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  })

  const [pairs, setPairs] = useState([])

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

  useEffect(() => {
    if (notes && emails && Array.isArray(notes) && Array.isArray(emails)) {
      const newPairs = leftJoin(notes, emails)
      setPairs(newPairs)
      console.log('Updated pairs:', newPairs)
    }
  }, [notes, emails])

  const handleDateChange = (newDate) => {
    console.log('newDate:', newDate)
    setDate(newDate)
  }

  const scrollToNextPair = (index) => {
    pairRefs.current[index]?.scrollIntoView({ behavior: 'smooth' })
  }

  if (notesError || emailsError) {
    console.error('Error:', notesError || emailsError)
    return <div>An error occurred: {notesError?.message || emailsError?.message}</div>
  }

  /*
  if (isLoadingNotes || isLoadingEmails) {
    return <div>Loading...</div>
  }
	*/

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
          <Note note={note} index={index} total={pairs.length}></Note>
          <Email
            initialEmail={email}
            noteFingerprint={note.fingerprint}
            emailStatus={emailStatuses?.[note.fingerprint]}
            updateStatus={updateStatus}
            index={index}
            total={pairs.length}
            scrollToNextPair={scrollToNextPair}
          ></Email>
        </div>
      ))}
    </div>
  )
}

// src/app/page.js

'use client'

import { useRef, useEffect } from 'react'
import Nav from './components/Nav'
import Note from './components/Note'
import Email from './components/Email'
import SpinnerIcon from './components/Icons/SpinnerIcon'
import Datepicker from 'react-tailwindcss-datepicker'
import { useNotes } from './hooks/useNotes'
import { useEmails } from './hooks/useEmails'
import { useEmailStatuses } from './hooks/useEmailStatus'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import { useQueryClient } from '@tanstack/react-query'
import { useVoice } from './hooks/useVoice'

const leftJoin = (notes, emails) => {
  if (!notes || !emails) return []
  return notes.map((note) => ({
    note,
    email: emails.find((email) => email?.fingerprint === note.fingerprint) || null,
  }))
}

export default function Home() {
  const queryClient = useQueryClient()
  const pairRefs = useRef([])

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const defaultDateRange = {
    startDate: yesterday.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  }

  const [date, setDate, syncDate] = useLocalStorage('notesDateRange', defaultDateRange)

  const {
    data: notes,
    isLoading: isLoadingNotes,
    error: notesError,
  } = useNotes(date.startDate, date.endDate)

  const { data: emailsData, isLoading: isLoadingEmails, error: emailsError } = useEmails(notes)

  const fingerprints = notes?.map((note) => note.fingerprint) || []
  const { data: emailStatuses, updateStatus } = useEmailStatuses(fingerprints)

  const latestEmails = queryClient.getQueryData(['emails']) || emailsData
  const pairs =
    notes && latestEmails && Array.isArray(notes) && Array.isArray(latestEmails)
      ? leftJoin(notes, latestEmails)
      : []

  const handleDateChange = (newDate) => {
    console.log('newDate:', newDate)
    if (newDate?.startDate && newDate?.endDate) {
      setDate({
        startDate: newDate.startDate,
        endDate: newDate.endDate,
      })
      syncDate() // Sync the new date to localStorage
    } else {
      console.error('Invalid date range received:', newDate)
    }
  }

  const scrollToNextPair = (index) => {
    pairRefs.current[index]?.scrollIntoView({ behavior: 'smooth' })
  }

  const {
    activeCallFingerprint,
    isPending,
    isResponding,
    connectConversation,
    disconnectConversation,
    cancelResponse,
  } = useVoice()

  // biome-ignore lint/correctness/useExhaustiveDependencies: syncDate is a callback function
  useEffect(() => {
    syncDate()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [])

  return (
    <div className="flex h-screen snap-y snap-mandatory flex-col items-center overflow-y-scroll">
      <div className="sticky top-0 z-50 -mt-16 w-full bg-white/50 backdrop-blur-md">
        <Nav>
          <Datepicker
            useRange={false}
            primaryColor={'teal'}
            placeholder={'Select date range'}
            separator={'-'}
            displayFormat={'M/D/YY'}
            inputClassName={
              'h-8 w-32 sm:h-10 sm:w-40 items-center overflow-hidden rounded pt-0.5 focus-visible:outline-none align-middle text-right cursor-pointer bg-transparent text-sm sm:text-base'
            }
            readOnly={true}
            containerClassName={'relative w-fit text-black border-color z-30'}
            toggleClassName={
              'h-8 w-fit sm:h-10 items-center overflow-hidden rounded px-2 sm:px-4 pb-0.5 text-sm sm:text-base font-bold hover:bg-opacity-95 active:bg-opacity-100 bg-teal text-white align-middle ml-2 sm:ml-4'
            }
            value={{
              startDate: date.startDate,
              endDate: date.endDate,
            }}
            onChange={handleDateChange}
          />
        </Nav>
      </div>

      {isLoadingNotes || isLoadingEmails ? (
        <div className="flex h-screen items-center justify-center text-neutral-500">
          <SpinnerIcon className="scale-150" />
        </div>
      ) : notesError || emailsError ? (
        <div className="flex items-center justify-center text-neutral-700">
          <div className="max-w-screen-md px-4 sm:px-6">
            {notesError && (
              <div className="space-y-4 sm:space-y-6">
                <div className="text-base font-semibold sm:text-lg">Notes Error:</div>
                <pre className="font-mono whitespace-pre-wrap text-xs sm:text-sm">
                  {notesError.message}
                </pre>
              </div>
            )}
            {emailsError && (
              <div className="mt-4 sm:mt-6">
                <div className="text-base font-semibold sm:text-lg">Emails Error:</div>
                <p className="text-sm sm:text-base">
                  {emailsError.message || 'An unknown error occurred while fetching emails.'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : pairs.length === 0 ? (
        <div className="flex items-center justify-center text-sm text-neutral-700 sm:text-base">
          No notes found for the selected date range.
        </div>
      ) : null}

      {pairs.map(({ note, email }, index) => (
        <div
          key={note.fingerprint}
          ref={(el) => {
            pairRefs.current[index] = el
          }}
          className="pair -!mx-[10px] container -m-4 flex max-w-screen-2xl snap-center snap-always p-4 pb-0"
        >
          <Note note={note} index={index} total={pairs.length} />
          <Email
            initialEmail={email}
            noteFingerprint={note.fingerprint}
            note={note}
            index={index}
            total={pairs.length}
            scrollToNextPair={scrollToNextPair}
            emailStatus={emailStatuses?.[note.fingerprint]}
            updateStatus={updateStatus}
          />
        </div>
      ))}
    </div>
  )
}

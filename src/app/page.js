// src/app/page.js

'use client'

import { Fragment, useEffect, useState, useRef } from 'react'
import Note from './components/Note'
import EditableEmail from './components/EditableEmail'
import Nav from './components/Nav'
import { parse } from 'best-effort-json-parser'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import { useLocalStorage } from './utils/useLocalStorage'
import { merge, leftJoin } from './utils/arrayUtils'
import SpinnerIcon from './components/Icons/SpinnerIcon'
import RefreshIcon from './components/Icons/RefreshIcon-v4'
import { timestamp } from './utils/timestamp'

export default function Home() {
  const [pairs, setPairs] = useState([])
  const [notesExist, setNotesExist] = useState(true)
  const emailEventSourceRef = useRef(null)
  const pairRefs = useRef([])
  const [cachedEmails, setCachedEmails] = useLocalStorage('emailsCache', [])
  const [cachedNotes, setCachedNotes] = useLocalStorage('notesCache', [])

  const closeEventSource = () => {
    if (emailEventSourceRef.current) {
      emailEventSourceRef.current.close()
      emailEventSourceRef.current = null
    }
  }

  const fetchData = async (refresh = false) => {
    console.log(`${timestamp()} Fetching data, refresh: ${refresh}`)

    // Fetch notes
    let notes = []
    try {
      // Try to fetch from /api/notes (which reads from disk first)
      notes = await fetch('/api/notes').then((res) => res.json())
      if (notes.length === 0) {
        // If no notes from disk, use cached notes (which would be from Firestore or local storage)
        notes = cachedNotes
      }
    } catch (error) {
      console.warn(`${timestamp()} Failed to fetch notes:`, String(error).split('\n')[0])
      notes = cachedNotes // Use cached notes if API fails
    }

    // Update cached notes
    setCachedNotes(notes)

    // Return if no notes
    if (notes.length === 0) {
      setNotesExist(false)
      return
    } else {
      setNotesExist(true)
    }

    // Fetch emails
    closeEventSource()

    let url = '/api/emails'
    if (refresh === 'all') {
      url += '?refresh=all'
    } else if (refresh.length === 40) {
      url += '?refresh=' + refresh
    }

    try {
      // Get emails as SSE stream
      const emailEvents = new EventSource(url)
      emailEventSourceRef.current = emailEvents

      let emailsJson = ''
      let allEmails = refresh.length === 40 ? [...cachedEmails] : []

      emailEvents.addEventListener('message', (event) => {
        const data = parse(event.data)
        const chunk = data?.chunk // string when streaming, object when full response
        const status = data?.status

        if (chunk && chunk.error) {
          console.warn(`${timestamp()} Error from server:`, chunk.error)
        }

        let emails = []
        if (typeof chunk === 'object') {
          // Full response
          emails = chunk?.emails
        } else {
          // Streaming response
          emailsJson += chunk
          emails = parse(emailsJson)?.emails
        }

        if (typeof emails !== 'undefined') {
          // Only process emails key if it exists
          const filteredEmails = emails.filter((email) => email?.fingerprint?.length === 40)

          if (status === 'stop') {
            // 'stop' refers to the current chunk
            // Combine contents of this streamed chunk with previous
            allEmails = merge(allEmails, filteredEmails)
            emailsJson = ''
            setCachedEmails(allEmails)
          }
          allEmails = merge(allEmails, filteredEmails)
          setCachedEmails(allEmails)

          const joined = leftJoin({ notes, emails: allEmails })
          setPairs(joined)
          console.log(joined)
        }

        if (status === 'complete') {
          console.log(`${timestamp()} Received complete message, closing event source`)
          closeEventSource()
        }
      })

      emailEvents.addEventListener('error', (event) => {
        console.error(`${timestamp()} EventSource error:`, event)
        closeEventSource()
        // Use cached emails if API fails
        const joined = leftJoin({ notes, emails: cachedEmails })
        setPairs(joined)
      })
    } catch (error) {
      console.warn('${timestamp()} Error fetching emails:', String(error).split('\n')[0])

      // Utilize the cached emails if API call fails
      const joined = leftJoin({ notes, emails: cachedEmails })
      setPairs(joined)
    }
  }

  const handleClear = () => {
    setPairs([])
    setNotesExist(false)
    setCachedNotes([])
    setCachedEmails([])
  }

  useEffect(() => {
    fetchData()

    return () => {
      closeEventSource()
    }
  }, [])

  return (
    <>
      <div className="flex h-screen max-w-full snap-y snap-mandatory flex-col items-center overflow-y-scroll">
        <Nav
          fetchData={fetchData}
          notesExist={notesExist}
          pairRefs={pairRefs}
          onClear={handleClear}
        />
        {notesExist &&
          pairs.map((pair, index) => (
            <Fragment key={pair.note.fingerprint}>
              <div
                ref={(el) => (pairRefs.current[index] = el)}
                className="container -m-4 flex max-w-screen-2xl snap-center snap-always p-4 pb-0"
              >
                <div className="left -ml-full flex min-h-screen flex-1 flex-col justify-center border-s bg-neutral-200 p-10 pl-full pt-32">
                  <div className="note w-full rounded-lg bg-white p-10">
                    <Note {...pair.note} />
                  </div>
                  <div className="p-10 pb-0 text-lg">
                    Note <span className="font-bold">{index + 1}</span> of{' '}
                    <span className="font-bold">{pairs.length}</span>
                  </div>
                </div>
                <div className="right -mr-4 flex min-h-screen flex-1.4 flex-col justify-center pt-6">
                  <div className="email flex flex-col p-10 pr-4">
                    {pair.email ? (
                      <>
                        {pair.email.subject && (
                          <h2 className="mb-2.5 text-2xl font-bold text-teal">
                            {pair.email.subject}
                          </h2>
                        )}
                        {pair.email.body ? (
                          <EditableEmail
                            className="relative mb-4 flex flex-col"
                            {...pair.email}
                            onEmailSent={() => handleSendEmailButtonClick(index)}
                            fetchData={fetchData}
                          />
                        ) : (
                          pair.email.error && (
                            <div className="relative inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
                              <button
                                onClick={() => fetchData(pair.note.fingerprint)}
                                className="refresh absolute right-0 top-0 z-10 m-6 self-end"
                              >
                                <span className="-mx-1 -my-0.5 flex items-center gap-1.5">
                                  <RefreshIcon className="h-5 w-5" />
                                </span>
                              </button>
                              <ExclamationTriangleIcon className="m-4 w-10" />
                              <div>{pair.email?.error}</div>
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
            </Fragment>
          ))}
      </div>
    </>
  )
}

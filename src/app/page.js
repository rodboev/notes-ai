// src/app/page.js

'use client'

import { Fragment, useEffect, useState, useRef } from 'react'
import Note from './components/Note'
import EditableEmail from './components/EditableEmail'
import Nav from './components/Nav'
import { parse } from 'best-effort-json-parser'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import { useLocalStorage } from './utils/useLocalStorage'
import { merge, leftJoin } from './utils/mergingFns'
import Spinner from './components/Icons/SpinnerIcon'

export default function Home() {
  const [pairs, setPairs] = useState([])
  const [notesExist, setNotesExist] = useState(true)
  const emailEventSourceRef = useRef(null)
  const pairRefs = useRef([])
  const [cachedEmails, setCachedEmails, syncCachedEmails] = useLocalStorage('emailsCache', [])
  const [cachedNotes, setCachedNotes, syncCachedNotes] = useLocalStorage('notesCache', [])

  const closeEventSource = () => {
    if (emailEventSourceRef.current) {
      emailEventSourceRef.current.close()
      emailEventSourceRef.current = null
    }
  }

  const fetchData = async (refresh = false) => {
    let logStr = `Fetching data, refresh: ${refresh}`
    console.log(logStr)

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
      console.warn('Failed to fetch notes:', String(error).split('\n')[0])
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
      let allEmails = []

      emailEvents.addEventListener('message', (event) => {
        const data = parse(event.data)?.chunk
        const status = parse(event.data)?.status
        if (status !== 'stream') {
          console.log(`Received { status: "${status}" }`)
        }
        emailsJson += data
        const emails = parse(emailsJson)?.emails

        if (typeof emails !== 'undefined') {
          const filteredEmails = emails.filter((email) => email?.fingerprint?.length === 40)

          if (status === 'stop') {
            allEmails = merge(allEmails, filteredEmails)
            emailsJson = ''
            setCachedEmails(allEmails)
          }
          allEmails = merge(allEmails, filteredEmails)
          setCachedEmails(allEmails)

          const joined = leftJoin({ notes, emails: allEmails })
          setPairs(joined)
        }
      })

      emailEvents.addEventListener('error', (event) => {
        emailEvents.close()
        emailEventSourceRef.current = null
        console.log('Error fetching emails:', event)
        // Use cached emails if API fails
        const joined = leftJoin({ notes, emails: cachedEmails })
        setPairs(joined)
      })
    } catch (error) {
      console.error('Error fetching emails:', String(error).split('\n')[0])

      // Utilize the cached emails if API call fails
      const joined = leftJoin({ notes, emails: cachedEmails })
      setPairs(joined)
    }
  }

  const handleSendEmailButtonClick = (index) => {
    setTimeout(() => {
      if (index + 1 < pairRefs.current.length) {
        pairRefs.current[index + 1].scrollIntoView({ behavior: 'smooth' })
      }
    }, 100)
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
          className="fixed left-0 z-10 flex w-full justify-center border-b bg-white/50 p-3 backdrop-blur-md"
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
                        {pair.email.body && (
                          <EditableEmail
                            className="relative mb-4 flex flex-col"
                            htmlContent={pair.email.body}
                            subject={pair.email.subject}
                            to="a.dallas@libertypestnyc.com, r.boev@libertypestnyc.com"
                            onEmailSent={() => handleSendEmailButtonClick(index)}
                            fingerprint={pair.note.fingerprint}
                            fetchData={fetchData}
                          />
                        )}
                        {pair.email.error && (
                          <div className="inline-flex min-w-96 max-w-2xl flex-col items-center self-center rounded-lg border-2 border-dashed px-10 py-14 text-neutral-500">
                            <ExclamationTriangleIcon className="m-4 w-10" />
                            <div>{pair.email?.error}</div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="inline-flex flex-col items-center text-neutral-500">
                        <Spinner className="scale-150 text-neutral-500" />
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

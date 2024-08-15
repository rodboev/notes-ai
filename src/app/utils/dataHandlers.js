// src/app/utils/dataHandlers.js

import { parse } from 'best-effort-json-parser'
import { merge, leftJoin } from './arrayUtils'
import { timestamp } from './timestamp'

export const fetchData = async ({
  refresh = false,
  cachedNotes,
  cachedEmails,
  setCachedNotes,
  setCachedEmails,
  setPairs,
  setNotesExist,
  emailEventSourceRef,
  startDate,
  endDate,
  fingerprint = null,
}) => {
  console.log(
    `${timestamp()} Fetching data, refresh: ${refresh}, startDate: ${startDate}, endDate: ${endDate}, fingerprint: ${fingerprint}`,
  )

  // Use cached notes or fetch new ones
  let notes = cachedNotes[`${startDate}_${endDate}`] || []

  // Fetch new notes only if necessary
  if (!notes.length || (fingerprint && !notes.some((note) => note.fingerprint === fingerprint))) {
    try {
      let url = fingerprint
        ? `/api/notes?fingerprint=${fingerprint}`
        : `/api/notes?startDate=${startDate}&endDate=${endDate}`
      const response = await fetch(url)
      const newNotes = await response.json()

      if (fingerprint) {
        // For single note refresh, merge with existing notes
        notes = merge(notes, newNotes)
      } else {
        notes = newNotes
      }

      setCachedNotes({ ...cachedNotes, [`${startDate}_${endDate}`]: notes })
    } catch (error) {
      console.warn(`${timestamp()} Failed to fetch notes:`, String(error).split('\n')[0])
    }
  }

  setNotesExist(notes.length > 0)

  if (notes.length === 0) {
    setNotesExist(false)
    return
  } else {
    setNotesExist(true)
  }

  // Fetch emails
  const closeEventSource = () => {
    if (emailEventSourceRef.current) {
      emailEventSourceRef.current.close()
      emailEventSourceRef.current = null
    }
  }
  closeEventSource()

  let url = fingerprint
    ? `/api/emails?fingerprint=${fingerprint}&refresh=${fingerprint}`
    : `/api/emails?startDate=${startDate}&endDate=${endDate}`

  if (refresh === 'all') {
    url += '&refresh=all'
  }

  try {
    const emailEvents = new EventSource(url)
    emailEventSourceRef.current = emailEvents

    let emailsJson = ''
    let allEmails = refresh.length === 40 ? [...cachedEmails] : []

    const updatePairs = (emails) => {
      console.log(`Joining ${notes.length} notes and ${emails.length} emails`)
      const joined = leftJoin({ notes, emails })
      setPairs(joined)
    }

    emailEvents.addEventListener('message', (event) => {
      const data = parse(event.data)
      const chunk = data?.chunk
      const status = data?.status

      if (chunk && chunk.error) {
        console.warn(`${timestamp()} Error from server:`, chunk.error)
      }

      let emails = []
      if (typeof chunk === 'object') {
        emails = chunk?.emails
      } else {
        emailsJson += chunk
        emails = parse(emailsJson)?.emails
      }

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

      if (status === 'complete') {
        console.log(`${timestamp()} Received complete message, closing event source`)
        closeEventSource()
      }
    })

    emailEvents.addEventListener('error', (event) => {
      console.error(`${timestamp()} EventSource error:`, event)
      closeEventSource()
      const joined = leftJoin({ notes, emails: cachedEmails })
      setPairs(joined)
    })
  } catch (error) {
    console.warn(`${timestamp()} Error fetching emails:`, String(error).split('\n')[0])
    const joined = leftJoin({ notes, emails: cachedEmails })
    setPairs(joined)
  }
}

export const clearData = (setPairs, setNotesExist, setCachedNotes, setCachedEmails) => {
  setPairs([])
  setNotesExist(false)
  setCachedNotes({})
  setCachedEmails([])
}

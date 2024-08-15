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
    `${timestamp()} Fetching data, refresh: ${refresh}, startDate: ${startDate}, endDate: ${endDate}`,
  )

  // Fetch notes
  let notes = []
  try {
    if (fingerprint) {
      notes = await fetch(`/api/notes?fingerprint=${fingerprint}`).then((res) => res.json())
    } else {
      notes = await fetch(`/api/notes?startDate=${startDate}&endDate=${endDate}`).then((res) =>
        res.json(),
      )
    }
    if (notes.length === 0) {
      notes = cachedNotes[`${startDate}_${endDate}`] || []
    }
  } catch (error) {
    console.warn(`${timestamp()} Failed to fetch notes:`, String(error).split('\n')[0])
    notes = cachedNotes[`${startDate}_${endDate}`] || []
  }

  setCachedNotes({ ...cachedNotes, [`${startDate}_${endDate}`]: notes })

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

  let url = `/api/emails?startDate=${startDate}&endDate=${endDate}`
  if (refresh === 'all') {
    url += '&refresh=all'
  } else if (refresh.length === 40) {
    url += '&refresh=' + refresh
  }

  try {
    const emailEvents = new EventSource(url)
    emailEventSourceRef.current = emailEvents

    let emailsJson = ''
    let allEmails = refresh.length === 40 ? [...cachedEmails] : []

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

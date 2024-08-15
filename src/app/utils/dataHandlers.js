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
  console.log(
    `${timestamp()} cachedNotes: ${cachedNotes.length}, cachedEmails: ${cachedEmails.length}`,
  )

  // Fetch or use cached notes
  let notes = cachedNotes[`${startDate}_${endDate}`] || []
  if (!notes.length || fingerprint) {
    try {
      const url = fingerprint
        ? `/api/notes?fingerprint=${fingerprint}&startDate=${startDate}&endDate=${endDate}`
        : `/api/notes?startDate=${startDate}&endDate=${endDate}`
      const response = await fetch(url)
      const newNotes = await response.json()

      notes = fingerprint ? merge(notes, newNotes) : newNotes
      setCachedNotes({ ...cachedNotes, [`${startDate}_${endDate}`]: notes })
    } catch (error) {
      console.warn(`${timestamp()} Failed to fetch notes:`, String(error).split('\n')[0])
    }
  }

  setNotesExist(notes.length > 0)
  if (notes.length === 0) return

  // Get fingerprints of needed emails
  const neededFingerprints = notes.map((note) => note.fingerprint)

  // Fetch emails
  const closeEventSource = () => {
    if (emailEventSourceRef.current) {
      emailEventSourceRef.current.close()
      emailEventSourceRef.current = null
    }
  }
  closeEventSource()

  let url = `/api/emails?startDate=${startDate}&endDate=${endDate}&fingerprints=${neededFingerprints.join(',')}`
  if (fingerprint) {
    url += `&fingerprint=${fingerprint}&refresh=${refresh}`
  }
  if (refresh === 'all') {
    url += '&refresh=all'
  }

  try {
    const emailEvents = new EventSource(url)
    emailEventSourceRef.current = emailEvents

    let emailsJson = ''
    let allEmails = refresh === 'all' ? [] : [...cachedEmails]

    const updatePairs = (emails) => {
      const filteredEmails = emails.filter((email) =>
        neededFingerprints.includes(email.fingerprint),
      )
      const joined = leftJoin({ notes, emails: filteredEmails })
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

      if (Array.isArray(emails)) {
        const filteredEmails = emails.filter((email) => email?.fingerprint?.length === 40)

        if (status === 'stop') {
          allEmails = merge(allEmails, filteredEmails)
          emailsJson = ''
          setCachedEmails(allEmails)
        }
        allEmails = merge(allEmails, filteredEmails)
        setCachedEmails(allEmails)

        updatePairs(allEmails)
      }

      if (status === 'complete') {
        console.log(`${timestamp()} Received complete message, closing event source`)
        closeEventSource()
      }
    })

    emailEvents.addEventListener('error', (event) => {
      console.error(`${timestamp()} EventSource error:`, event)
      closeEventSource()
      updatePairs(cachedEmails)
    })
  } catch (error) {
    console.warn(`${timestamp()} Error fetching emails:`, String(error).split('\n')[0])
    updatePairs(cachedEmails)
  }
}

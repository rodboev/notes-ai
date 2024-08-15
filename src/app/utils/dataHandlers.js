// src/app/utils/dataHandlers.js

import { parse } from 'best-effort-json-parser'
import { merge, leftJoin } from './arrayUtils'
import { timestamp } from './timestamp'

export const fetchData = async ({
  refresh = false,
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

  // Fetch notes
  let notes = []
  try {
    const url = fingerprint
      ? `/api/notes?fingerprint=${fingerprint}&startDate=${startDate}&endDate=${endDate}`
      : `/api/notes?startDate=${startDate}&endDate=${endDate}`
    const response = await fetch(url)
    notes = await response.json()
  } catch (error) {
    console.warn(`${timestamp()} Failed to fetch notes:`, String(error).split('\n')[0])
  }

  setNotesExist(notes.length > 0)
  if (notes.length === 0) return

  // Get fingerprints of needed emails
  const neededFingerprints = notes.map((note) => note.fingerprint)

  console.log(`${timestamp()} Total emails needed: ${neededFingerprints.length}`)

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
    let allEmails = []

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
        }
        allEmails = merge(allEmails, filteredEmails)

        updatePairs(notes, allEmails, setPairs)
      }

      if (status === 'complete') {
        console.log(`${timestamp()} Received complete message, closing event source`)
        closeEventSource()
      }
    })

    emailEvents.addEventListener('error', (event) => {
      console.error(`${timestamp()} EventSource error:`, event)
      closeEventSource()
      updatePairs(notes, [], setPairs)
    })
  } catch (error) {
    console.warn(`${timestamp()} Error fetching emails:`, String(error).split('\n')[0])
    updatePairs(notes, [], setPairs)
  }
}

const updatePairs = (notes, emails, setPairs) => {
  const filteredEmails = emails.filter((email) =>
    notes.some((note) => note.fingerprint === email.fingerprint),
  )
  const joined = leftJoin({ notes, emails: filteredEmails })
  setPairs(joined)
  console.log(`${timestamp()} Updated pairs: ${joined.length}`)
}

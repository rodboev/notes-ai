// src/app/hooks/useEmails.js

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parse } from 'best-effort-json-parser'
import { timestamp } from '../utils/timestamp'
import { useState, useEffect, useCallback } from 'react'

const merge = (arrayList1, arrayList2) => [
  ...[]
    .concat(arrayList1, arrayList2)
    .reduce((r, c) => r.set(c.fingerprint, Object.assign(r.get(c.fingerprint) || {}, c)), new Map())
    .values(),
]

const createEventSource = (url, onMessage, onError) => {
  const emailEvents = new EventSource(url)
  emailEvents.addEventListener('message', onMessage)
  emailEvents.addEventListener('error', onError)
  return emailEvents
}

export const useEmails = (notes) => {
  const queryClient = useQueryClient()
  const [emailsUpdateCounter, setEmailsUpdateCounter] = useState(0)

  const fetchEmails = useCallback(async () => {
    if (!notes || notes.length === 0) return []

    const fingerprints = notes.map((note) => note.fingerprint)
    const url = `/api/emails?fingerprints=${fingerprints.join(',')}`

    return new Promise((resolve, reject) => {
      let allEmails = []
      let streamingJson = ''

      const eventSource = new EventSource(url)

      eventSource.onmessage = (event) => {
        const { chunk, status } = JSON.parse(event.data)

        if (status === 'stored') {
          const parsedChunk = parse(chunk)
          // console.log('parsedChunk', parsedChunk)
          allEmails = merge(allEmails, parsedChunk?.emails || [])
        } else if (status === 'streaming') {
          // Handle streaming data
          streamingJson += chunk
          const parsedJson = parse(streamingJson.trim())
          const validParsedEmails = parsedJson?.emails?.filter(
            (email) => email.fingerprint && email.fingerprint.length === 40,
          )
          allEmails = merge(allEmails, validParsedEmails || [])
          // Update the query data after each merge
          queryClient.setQueryData(['emails'], allEmails)
          setEmailsUpdateCounter((prev) => prev + 1) // Add this line
          // console.log('Updated setEmailsUpdateCounter')
          // console.log(`Updated emails query cache to ${allEmails.length} emails`)
        } else if (status === 'streaming-object-complete') {
          // We are clearing the previous streamed object here so adjacent objects in the response can be parsed separately
          streamingJson = ''
        } else if (status === 'complete') {
          eventSource.close()
          resolve(allEmails)
        } else if (status === 'error') {
          eventSource.close()
          reject(new Error(chunk.error || 'Unknown error'))
        }
      }

      eventSource.onerror = (error) => {
        eventSource.close()
        reject(error)
      }
    })
  }, [notes, queryClient])

  const query = useQuery({
    queryKey: ['emails', notes],
    queryFn: fetchEmails,
    enabled: !!notes && notes.length > 0,
  })

  return { ...query, emailsUpdateCounter }
}

export const useSingleEmail = (fingerprint) => {
  const queryClient = useQueryClient()

  const fetchSingleEmail = useCallback(async () => {
    if (!fingerprint) return null

    const url = `/api/emails?fingerprint=${fingerprint}`
    let streamingJson = ''

    return new Promise((resolve, reject) => {
      const onMessage = (event) => {
        const data = parse(event.data)
        const chunk = data?.chunk
        const status = data?.status

        console.log(status)

        if (chunk && chunk.error) {
          console.warn(`${timestamp()} Error from server:`, chunk.error)
          return
        }

        let newEmails = []

        if (typeof chunk === 'object') {
          newEmails = chunk?.emails
        } else if (typeof chunk === 'string') {
          streamingJson += chunk
          newEmails = parse(streamingJson)?.emails
        }

        if (newEmails?.length > 0) {
          const filteredEmails = newEmails.filter((email) => email?.fingerprint?.length === 40)
          if (filteredEmails.length > 0) {
            const singleEmail = filteredEmails[0]
            queryClient.setQueryData(['emails'], (oldData) => {
              if (Array.isArray(oldData)) {
                return oldData.map((email) =>
                  email.fingerprint === fingerprint ? singleEmail : email,
                )
              }
              return oldData
            })
            queryClient.setQueryData(['email', fingerprint], singleEmail)
            // console.log('Updated single email:', singleEmail)
          }
        }

        if (status === 'streaming-object-complete') {
          console.log('streaming-object-complete for single email')
          // We are clearing the previous streamed object here so adjacent objects in the response can be parsed separately
          streamingJson = ''
        }

        if (status === 'complete') {
          console.log(
            `${timestamp()} Received complete message for single email, closing event source`,
          )
          emailEvents.close()
          resolve(queryClient.getQueryData(['email', fingerprint]))
        }
      }

      const onError = (event) => {
        console.warn('SSE error for single email:', event)
        emailEvents.close()
        reject(new Error('Failed to fetch single email'))
      }

      const emailEvents = createEventSource(url, onMessage, onError)
    })
  }, [fingerprint, queryClient])

  const query = useQuery({
    queryKey: ['email', fingerprint],
    queryFn: fetchSingleEmail,
    enabled: false, // This ensures the query doesn't run automatically
  })

  const refreshEmail = useCallback(() => {
    if (fingerprint) {
      query.refetch()
    }
  }, [fingerprint, query])

  return { ...query, refreshEmail }
}

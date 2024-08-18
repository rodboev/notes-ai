// src/app/hooks/useEmails.js

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parse } from 'best-effort-json-parser'
import { useState, useCallback } from 'react'

const merge = (arrayList1, arrayList2) => [
  ...[]
    .concat(arrayList1, arrayList2)
    .reduce((r, c) => r.set(c.fingerprint, Object.assign(r.get(c.fingerprint) || {}, c)), new Map())
    .values(),
]

const processServerMessage = ({
  event,
  streamingJson,
  allEmails,
  queryClient,
  setEmailsUpdateCounter,
  fingerprint,
}) => {
  const { chunk, status } = JSON.parse(event.data)

  if (status === 'stored') {
    // Handle full response
    const parsedChunk = parse(chunk)
    allEmails = merge(allEmails, parsedChunk?.emails || [])
    if (fingerprint && parsedChunk?.emails?.length > 0) {
      queryClient.setQueryData(['email', fingerprint], parsedChunk.emails[0])
    }
  } else if (status === 'streaming') {
    // Handle streaming data
    streamingJson += chunk
    const parsedJson = parse(streamingJson.trim())
    const validEmails =
      parsedJson?.emails?.filter((email) => email.fingerprint?.length === 40) || []

    if (fingerprint) {
      if (validEmails.length > 0) {
        queryClient.setQueryData(['email', fingerprint], validEmails[0])
      }
    } else {
      allEmails = merge(allEmails, validEmails)
      // Update the query data after each merge
      queryClient.setQueryData(['emails'], allEmails)
      setEmailsUpdateCounter?.((prev) => prev + 1)
    }
  } else if (status === 'streaming-object-complete') {
    // We are clearing the previous streamed object here so adjacent objects in the response can be parsed separately
    streamingJson = ''
  } else if (status === 'complete' || status === 'error') {
    return {
      status,
      allEmails,
      streamingJson,
      error: status === 'error' ? new Error(chunk.error || 'Unknown error') : null,
    }
  }

  return { status, allEmails, streamingJson, error: null }
}

const createEventSourceHandler = ({ url, queryClient, setEmailsUpdateCounter, fingerprint }) => {
  return new Promise((resolve, reject) => {
    let allEmails = [],
      streamingJson = ''
    const eventSource = new EventSource(url)

    const handleMessage = (event) => {
      const result = processServerMessage({
        event,
        streamingJson,
        allEmails,
        queryClient,
        setEmailsUpdateCounter,
        fingerprint,
      })
      streamingJson = result.streamingJson
      allEmails = result.allEmails

      if (result.status === 'complete') {
        eventSource.close()
        resolve(fingerprint ? queryClient.getQueryData(['email', fingerprint]) : allEmails)
      } else if (result.status === 'error') {
        eventSource.close()
        reject(result.error)
      }
    }

    eventSource.onmessage = handleMessage
    eventSource.onerror = (error) => {
      eventSource.close()
      reject(error)
    }
  })
}

export const useEmails = (notes) => {
  const queryClient = useQueryClient()
  const [emailsUpdateCounter, setEmailsUpdateCounter] = useState(0)

  const fetchEmails = useCallback(async () => {
    if (!notes?.length) return []

    const url = `/api/emails?fingerprints=${notes.map((note) => note.fingerprint).join(',')}`
    try {
      return await createEventSourceHandler({
        url,
        queryClient,
        setEmailsUpdateCounter,
      })
    } catch (error) {
      console.error('Failed to fetch emails:', error)
      throw error
    }
  }, [notes, queryClient])

  const query = useQuery({
    queryKey: ['emails', notes],
    queryFn: fetchEmails,
    enabled: !!notes?.length,
  })

  return { ...query, emailsUpdateCounter }
}

export const useSingleEmail = (fingerprint) => {
  const queryClient = useQueryClient()

  const fetchSingleEmail = useCallback(async () => {
    if (!fingerprint) return null

    const url = `/api/emails?fingerprint=${fingerprint}`
    try {
      return await createEventSourceHandler({
        url,
        queryClient,
        fingerprint,
      })
    } catch (error) {
      console.error('Failed to fetch single email:', error)
      throw error
    }
  }, [fingerprint, queryClient])

  const query = useQuery({
    queryKey: ['email', fingerprint],
    queryFn: fetchSingleEmail,
    enabled: false,
  })

  return { ...query, refreshEmail: query.refetch }
}

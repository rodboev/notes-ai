// src/app/hooks/useEmails.js

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parse } from 'best-effort-json-parser'
import { useState, useCallback, useRef, useEffect } from 'react'

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
      error: chunk.error ? JSON.stringify(chunk.error, null, 2) : 'Unknown error',
    }
  } else if (status === 'error') {
    let errorMessage = 'Unknown error'
    let errorDetails = {}
    if (typeof chunk?.error === 'string') {
      errorMessage = chunk.error
    } else if (chunk?.error?.message) {
      errorMessage = chunk.error.message
      errorDetails = chunk.error
    }
    return {
      status,
      allEmails,
      streamingJson,
      error: new Error(errorMessage, { cause: errorDetails }),
    }
  }

  return { status, allEmails, streamingJson, error: null }
}

const createEventSourceHandler = ({
  url,
  queryClient,
  setEmailsUpdateCounter,
  fingerprint,
  cleanupRef,
}) => {
  return new Promise((resolve, reject) => {
    let allEmails = [],
      streamingJson = ''
    const eventSource = new EventSource(url)

    const cleanup = () => {
      eventSource.close()
      // Reset counter when request is aborted or completed
      if (typeof setEmailsUpdateCounter === 'function') {
        setEmailsUpdateCounter(0)
      }
    }

    // Store the cleanup function in the ref
    if (cleanupRef) {
      cleanupRef.current = cleanup
    }

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
        cleanup()
        resolve(fingerprint ? queryClient.getQueryData(['email', fingerprint]) : allEmails)
      } else if (result.status === 'error') {
        cleanup()
        reject(result.error)
      }
    }

    eventSource.onmessage = handleMessage
    eventSource.onerror = (error) => {
      cleanup()
      reject(error)
    }
  })
}

export const useEmails = (notes) => {
  const queryClient = useQueryClient()
  const [emailsUpdateCounter, setEmailsUpdateCounter] = useState(0)
  const cleanupRef = useRef(null)

  useEffect(() => {
    return () => {
      // Call cleanup when component unmounts or notes change
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [notes])

  const fetchEmails = useCallback(async () => {
    if (!notes?.length) return []

    // Call previous cleanup if it exists
    if (cleanupRef.current) {
      cleanupRef.current()
    }

    const fingerprints = notes.map((note) => note.fingerprint).join(',')
    const url = `/api/emails?fingerprints=${fingerprints}`

    const emails = await createEventSourceHandler({
      url,
      queryClient,
      setEmailsUpdateCounter,
      cleanupRef,
    })
    return emails
  }, [notes, queryClient])

  const query = useQuery({
    queryKey: ['emails', notes],
    queryFn: fetchEmails,
    enabled: !!notes?.length,
    staleTime: 60000, // Consider data fresh for 1 minute
    cacheTime: 3600000, // Keep unused data in cache for 1 hour
  })

  useEffect(() => {
    setEmailsUpdateCounter(0)
  }, [notes])

  return { ...query, emailsUpdateCounter }
}

export const useSingleEmail = (fingerprint) => {
  const queryClient = useQueryClient()
  const cleanupRef = useRef(null)

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [fingerprint])

  const fetchSingleEmail = useCallback(async () => {
    if (!fingerprint) return null

    if (cleanupRef.current) {
      cleanupRef.current()
    }

    const url = `/api/emails?fingerprint=${fingerprint}`
    return await createEventSourceHandler({
      url,
      queryClient,
      fingerprint,
      cleanupRef,
    })
  }, [fingerprint, queryClient])

  const query = useQuery({
    queryKey: ['email', fingerprint],
    queryFn: fetchSingleEmail,
    enabled: false,
  })

  return { ...query, refreshEmail: query.refetch }
}

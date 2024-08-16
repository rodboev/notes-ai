// src/app/hooks/useEmails.js

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { parse } from 'best-effort-json-parser'
import { merge } from '../utils/arrayUtils'
import { timestamp } from '../utils/timestamp'
import api from '../utils/api'

export const useEmails = (notes) => {
  const [emails, setEmails] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const emailEventSourceRef = useRef(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!notes || notes.length === 0) {
      setIsLoading(false)
      return
    }

    const fingerprints = notes.map((note) => note.fingerprint).join(',')
    const url = `/api/emails?fingerprints=${fingerprints}`

    const fetchEmails = () => {
      setIsLoading(true)
      setError(null)

      const closeEventSource = () => {
        if (emailEventSourceRef.current) {
          emailEventSourceRef.current.close()
          emailEventSourceRef.current = null
        }
      }
      closeEventSource()

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
          setError(chunk.error)
        }

        let newEmails = []
        if (typeof chunk === 'object') {
          newEmails = chunk?.emails
        } else {
          emailsJson += chunk
          newEmails = parse(emailsJson)?.emails
        }

        if (Array.isArray(newEmails)) {
          const filteredEmails = newEmails.filter((email) => email?.fingerprint?.length === 40)

          if (status === 'stop') {
            allEmails = merge(allEmails, filteredEmails)
            emailsJson = ''
          }
          allEmails = merge(allEmails, filteredEmails)

          setEmails(allEmails)
          queryClient.setQueryData(['emails', notes], allEmails)
        }

        if (status === 'complete') {
          console.log(`${timestamp()} Received complete message, closing event source`)
          closeEventSource()
          setIsLoading(false)
        }
      })

      emailEvents.addEventListener('error', (event) => {
        console.error(`${timestamp()} EventSource error:`, event)
        closeEventSource()
        setError('Error fetching emails')
        setIsLoading(false)
      })
    }

    fetchEmails()

    return () => {
      if (emailEventSourceRef.current) {
        emailEventSourceRef.current.close()
      }
    }
  }, [notes, queryClient])

  return { data: emails, isLoading, error }
}

const fetchSingleEmail = async (fingerprint) => {
  if (!fingerprint) return null
  const response = await api.get(`/emails?fingerprint=${fingerprint}`)
  return response.data.emails[0]
}

export const useSingleEmail = (fingerprint) => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['email', fingerprint],
    queryFn: () => fetchSingleEmail(fingerprint),
    enabled: false, // This query won't run automatically
  })

  const refreshEmail = async () => {
    const result = await query.refetch()
    if (result.data) {
      queryClient.invalidateQueries(['emails'])
    }
    return result.data
  }

  return { ...query, refreshEmail }
}

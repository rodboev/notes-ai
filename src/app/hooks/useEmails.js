// src/app/hooks/useEmails.js

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parse } from 'best-effort-json-parser'
import { timestamp } from '../utils/timestamp'
import { useEffect, useCallback } from 'react'

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

  const query = useQuery({
    queryKey: ['emails'],
    queryFn: () => [],
    enabled: !!notes && notes.length > 0,
  })

  useEffect(() => {
    if (!notes || notes.length === 0) return

    const fingerprints = notes.map((note) => note.fingerprint)
    const url = `/api/emails?fingerprints=${fingerprints.join(',')}`

    let emailsJson = ''

    const onMessage = (event) => {
      const data = parse(event.data)
      const chunk = data?.chunk
      const status = data?.status

      if (chunk && chunk.error) {
        console.warn(`${timestamp()} Error from server:`, chunk.error)
        return
      }

      let newEmails = []

      if (typeof chunk === 'object') {
        newEmails = chunk?.emails
      } else if (typeof chunk === 'string') {
        emailsJson += chunk
        try {
          newEmails = parse(emailsJson)?.emails
        } catch (error) {
          console.error('Error parsing emails:', error)
        }
      }

      if (newEmails?.length > 0) {
        const filteredEmails = newEmails.filter((email) => email?.fingerprint?.length === 40)
        queryClient.setQueryData(['emails'], (oldData) => {
          const mergedEmails = merge(oldData || [], filteredEmails)
          console.log('mergedEmails', mergedEmails)
          return mergedEmails
        })
      }

      if (status === 'streaming-part-complete') {
        console.log('streaming-part-complete for multiple emails')
        emailsJson = ''
      }

      if (status === 'complete') {
        console.log('complete')
        console.log(
          `${timestamp()} Received complete message for multiple emails, closing event source`,
        )
        emailEvents.close()
      }
    }

    const onError = (event) => {
      console.warn('SSE error:', event)
      emailEvents.close()
    }

    const emailEvents = createEventSource(url, onMessage, onError)

    return () => {
      emailEvents.close()
    }
  }, [notes, queryClient])

  return {
    ...query,
    data: queryClient.getQueryData(['emails']) || [],
  }
}

export const useSingleEmail = (fingerprint) => {
  const queryClient = useQueryClient()

  const fetchSingleEmail = useCallback(async () => {
    if (!fingerprint) return null

    const url = `/api/emails?fingerprint=${fingerprint}`
    let emailsJson = ''

    return new Promise((resolve, reject) => {
      const onMessage = (event) => {
        const data = parse(event.data)
        const chunk = data?.chunk
        const status = data?.status

        if (chunk && chunk.error) {
          console.warn(`${timestamp()} Error from server:`, chunk.error)
          return
        }

        let newEmails = []

        if (typeof chunk === 'object') {
          newEmails = chunk?.emails
        } else if (typeof chunk === 'string') {
          emailsJson += chunk
          try {
            newEmails = parse(emailsJson)?.emails
          } catch (error) {
            console.error('Error parsing emails:', error)
          }
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
            console.log('Updated single email:', singleEmail)
          }
        }

        if (status === 'streaming-part-complete') {
          console.log('streaming-part-complete for single email')
          emailsJson = ''
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

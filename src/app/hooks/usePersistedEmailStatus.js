// src/app/hooks/usePersistedEmailStatus.js

import { useEffect } from 'react'
import { useEmailStatus } from '../contexts/EmailStatusContext'

export function usePersistedEmailStatus(fingerprint) {
  const [emailStatus, setEmailStatus, isLoading] = useEmailStatus(fingerprint)

  useEffect(() => {
    if (!isLoading && emailStatus) {
      localStorage.setItem(`emailStatus_${fingerprint}`, JSON.stringify(emailStatus))
    }
  }, [fingerprint, emailStatus, isLoading])

  const updateEmailStatus = (newStatus) => {
    let updatedStatus
    if (typeof newStatus === 'string') {
      // If it's a string, assume it's the status field
      updatedStatus = { ...emailStatus, status: newStatus }
    } else if (typeof newStatus === 'object') {
      // If it's an object, merge it with the existing status
      updatedStatus = { ...emailStatus, ...newStatus }
    } else {
      console.error('Invalid status format')
      return
    }

    setEmailStatus(updatedStatus)
    localStorage.setItem(`emailStatus_${fingerprint}`, JSON.stringify(updatedStatus))
  }

  const getPersistedStatus = () => {
    if (!isLoading) {
      const storedStatus = localStorage.getItem(`emailStatus_${fingerprint}`)
      if (storedStatus) {
        try {
          return JSON.parse(storedStatus)
        } catch (e) {
          console.error('Error parsing stored status:', e)
          // If parsing fails, return the context status
          return emailStatus
        }
      }
    }
    return emailStatus
  }

  return [getPersistedStatus(), updateEmailStatus, isLoading]
}

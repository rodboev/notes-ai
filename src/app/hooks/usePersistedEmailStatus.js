// src/app/hooks/usePersistedEmailStatus.js

import { useState, useEffect } from 'react'

export function usePersistedEmailStatus(fingerprint) {
  const [emailStatus, setEmailStatus] = useState(() => {
    if (typeof window !== 'undefined') {
      const storedStatus = localStorage.getItem(`emailStatus_${fingerprint}`)
      return storedStatus ? JSON.parse(storedStatus) : {}
    }
    return {}
  })

  useEffect(() => {
    if (Object.keys(emailStatus).length > 0) {
      localStorage.setItem(`emailStatus_${fingerprint}`, JSON.stringify(emailStatus))
    }
  }, [fingerprint, emailStatus])

  const updateEmailStatus = (newStatus) => {
    let updatedStatus
    if (typeof newStatus === 'string') {
      updatedStatus = { ...emailStatus, status: newStatus }
    } else if (typeof newStatus === 'object') {
      updatedStatus = { ...emailStatus, ...newStatus }
    } else {
      console.error('Invalid status format')
      return
    }

    setEmailStatus(updatedStatus)
  }

  return [emailStatus, updateEmailStatus]
}

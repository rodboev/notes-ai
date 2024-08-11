// src/app/hooks/usePersistedEmailStatus.js

import { useState, useEffect, useCallback } from 'react'

export function usePersistedEmailStatus() {
  const [emailStatuses, setEmailStatuses] = useState({})
  const [isLoading, setIsLoading] = useState(true)

  const fetchStatuses = useCallback(async () => {
    try {
      const response = await fetch('/api/status')
      if (response.ok) {
        const fetchedStatuses = await response.json()
        setEmailStatuses(fetchedStatuses)

        // Update localStorage with the latest data
        Object.entries(fetchedStatuses).forEach(([fingerprint, status]) => {
          localStorage.setItem(`emailStatus_${fingerprint}`, JSON.stringify(status))
        })
      } else {
        throw new Error('Failed to fetch statuses from server')
      }
    } catch (error) {
      console.error('Error fetching email statuses from server:', error)
      // Fall back to localStorage
      const localStatuses = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key.startsWith('emailStatus_')) {
          const fingerprint = key.replace('emailStatus_', '')
          try {
            localStatuses[fingerprint] = JSON.parse(localStorage.getItem(key))
          } catch (e) {
            console.error(`Error parsing stored status for ${fingerprint}:`, e)
          }
        }
      }
      setEmailStatuses(localStatuses)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatuses()
  }, [fetchStatuses])

  const updateEmailStatus = useCallback(
    async (fingerprint, newStatus) => {
      let updatedStatus
      if (typeof newStatus === 'string') {
        updatedStatus = { ...emailStatuses[fingerprint], status: newStatus }
      } else if (typeof newStatus === 'object') {
        updatedStatus = { ...emailStatuses[fingerprint], ...newStatus }
      } else {
        console.error('Invalid status format')
        return
      }

      setEmailStatuses((prev) => ({ ...prev, [fingerprint]: updatedStatus }))

      try {
        const response = await fetch('/api/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [fingerprint]: updatedStatus }),
        })
        if (!response.ok) throw new Error('Failed to update status on server')
        localStorage.setItem(`emailStatus_${fingerprint}`, JSON.stringify(updatedStatus))
      } catch (error) {
        console.error('Error updating email status on server:', error)
        localStorage.setItem(`emailStatus_${fingerprint}`, JSON.stringify(updatedStatus))
      }
    },
    [emailStatuses],
  )

  return [emailStatuses, updateEmailStatus, isLoading]
}

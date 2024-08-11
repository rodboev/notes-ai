// src/app/hooks/usePersistedEmailStatus.js

import { useState, useEffect, useCallback } from 'react'

let cachedStatuses = null
let lastFetchTime = 0
const CACHE_DURATION = 300 // 5 sec duration to allow for page load
let fetchPromise = null

export function usePersistedEmailStatus() {
  const [emailStatuses, setEmailStatuses] = useState(cachedStatuses || {})
  const [isLoading, setIsLoading] = useState(!cachedStatuses)

  const fetchStatuses = useCallback(async () => {
    const now = Date.now()

    // Use cached data if it's fresh
    if (cachedStatuses && now - lastFetchTime < CACHE_DURATION) {
      setEmailStatuses(cachedStatuses)
      setIsLoading(false)
      return
    }

    // If there's an ongoing fetch, wait for it instead of starting a new one
    if (fetchPromise) {
      await fetchPromise
      setEmailStatuses(cachedStatuses)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    fetchPromise = (async () => {
      try {
        const response = await fetch('/api/status')
        if (response.ok) {
          const fetchedStatuses = await response.json()
          setEmailStatuses(fetchedStatuses)
          cachedStatuses = fetchedStatuses
          lastFetchTime = Date.now()
        } else {
          throw new Error('Failed to fetch statuses from server')
        }
      } catch (error) {
        console.error('Error fetching email statuses from server:', error)
        // Fall back to localStorage only if there's no cached data
        if (!cachedStatuses) {
          const localStatuses = {}
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key.startsWith('emailStatus_')) {
              const fingerprint = key.replace('emailStatus_', '')
              try {
                localStatuses[fingerprint] = JSON.parse(localStorage.getItem(key))
              } catch (e) {
                console.warn(`Error parsing stored status for ${fingerprint}:`, e)
              }
            }
          }
          setEmailStatuses(localStatuses)
          cachedStatuses = localStatuses
        }
      } finally {
        setIsLoading(false)
        fetchPromise = null
      }
    })()

    await fetchPromise
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
        console.warn('Invalid status format')
        return
      }

      const updatedStatuses = { ...emailStatuses, [fingerprint]: updatedStatus }
      setEmailStatuses(updatedStatuses)
      cachedStatuses = updatedStatuses

      // Always update localStorage
      localStorage.setItem(`emailStatus_${fingerprint}`, JSON.stringify(updatedStatus))

      try {
        const response = await fetch('/api/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [fingerprint]: updatedStatus }),
        })
        if (!response.ok) throw new Error('Failed to update status on server')
      } catch (error) {
        console.warn('Error updating email status on server:', error)
      }
    },
    [emailStatuses],
  )

  return [emailStatuses, updateEmailStatus, isLoading, fetchStatuses]
}

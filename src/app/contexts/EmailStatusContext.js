// src/app/contexts/EmailStatusContext.js

'use client'

import React, { createContext, useState, useContext, useEffect } from 'react'
import { useLocalStorage } from '../utils/useLocalStorage'

const EmailStatusContext = createContext()

export function EmailStatusProvider({ children }) {
  const [allStatuses, setAllStatuses, syncLocalStatuses] = useLocalStorage(
    'emailStatuses',
    {},
  )
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAllStatuses = async () => {
      try {
        // Try to fetch from /api/status (which should read from disk first)
        const response = await fetch('/api/status')
        if (response.ok) {
          const statuses = await response.json()
          setAllStatuses(statuses)
        } else {
          // If API fails, use local storage
          syncLocalStatuses()
        }
      } catch (error) {
        console.error('Error fetching email statuses:', error)
        // Use local storage as fallback
        syncLocalStatuses()
      } finally {
        setIsLoading(false)
      }
    }

    fetchAllStatuses()
  }, [])

  const updateStatus = async (fingerprint, newStatus) => {
    setAllStatuses((prev) => ({
      ...prev,
      [fingerprint]: { ...prev[fingerprint], ...newStatus },
    }))
    try {
      await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fingerprint]: newStatus }),
      })
    } catch (error) {
      console.error('Error updating email status:', error)
    }
  }

  return (
    <EmailStatusContext.Provider
      value={{ allStatuses, updateStatus, isLoading }}
    >
      {children}
    </EmailStatusContext.Provider>
  )
}

export function useEmailStatus(fingerprint) {
  const context = useContext(EmailStatusContext)
  if (context === undefined) {
    throw new Error('useEmailStatus must be used within a EmailStatusProvider')
  }
  const { allStatuses, updateStatus, isLoading } = context
  return [
    allStatuses[fingerprint] || {},
    (newStatus) => updateStatus(fingerprint, newStatus),
    isLoading,
  ]
}

// src/app/hooks/useData.js
import { useState, useRef, useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { fetchData } from '../utils/dataHandlers'

export const useData = () => {
  const [pairs, setPairs] = useState([])
  const [notesExist, setNotesExist] = useState(true)
  const emailEventSourceRef = useRef(null)
  const [cachedEmails, setCachedEmails] = useLocalStorage('emailsCache', {})
  const [cachedNotes, setCachedNotes] = useLocalStorage('notesCache', {})
  const [error, setError] = useState(null)

  const fetchDataHandler = useCallback(
    async ({ startDate = null, endDate = null, fingerprint = null }) => {
      setError(null)
      try {
        await fetchData({
          refresh: fingerprint ? 'single' : false,
          cachedNotes,
          cachedEmails,
          setCachedNotes,
          setCachedEmails,
          setPairs,
          setNotesExist,
          emailEventSourceRef,
          startDate,
          endDate,
          fingerprint,
        })
      } catch (err) {
        console.error('Error fetching data:', err)
        setError(err.message)
      }
    },
    [cachedNotes, cachedEmails],
  )

  const clearHandler = useCallback(() => {
    setPairs([])
    setNotesExist(false)
    setCachedNotes({})
    setCachedEmails({})
  }, [])

  return {
    pairs,
    notesExist,
    fetchData: fetchDataHandler,
    clearData: clearHandler,
    error,
  }
}

// src/app/hooks/useData.js
import { useState, useRef, useCallback } from 'react'
import { fetchData } from '../utils/dataHandlers'

export const useData = () => {
  const [pairs, setPairs] = useState([])
  const [notesExist, setNotesExist] = useState(true)
  const emailEventSourceRef = useRef(null)
  const [error, setError] = useState(null)

  const fetchDataHandler = async ({ startDate = null, endDate = null, fingerprint = null }) => {
    setError(null)
    try {
      await fetchData({
        refresh: fingerprint ? fingerprint : false,
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
  }

  const clearHandler = () => {
    setPairs([])
    setNotesExist(false)
  }

  return {
    pairs,
    notesExist,
    fetchData: fetchDataHandler,
    clearData: clearHandler,
    error,
  }
}

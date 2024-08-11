// src/app/hooks/useData.js

import { useState, useRef, useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { fetchData, clearData, uploadData } from '../utils/dataHandlers'

export const useData = () => {
  const [pairs, setPairs] = useState([])
  const [notesExist, setNotesExist] = useState(true)
  const emailEventSourceRef = useRef(null)
  const [cachedEmails, setCachedEmails] = useLocalStorage('emailsCache', [])
  const [cachedNotes, setCachedNotes] = useLocalStorage('notesCache', [])

  const fetchDataHandler = useCallback(
    (refresh = false) => {
      fetchData(
        refresh,
        cachedNotes,
        cachedEmails,
        setCachedNotes,
        setCachedEmails,
        setPairs,
        setNotesExist,
        emailEventSourceRef,
      )
    },
    [cachedNotes, cachedEmails],
  )

  const clearHandler = useCallback(() => {
    clearData(setPairs, setNotesExist, setCachedNotes, setCachedEmails)
  }, [])

  const uploadHandler = useCallback(async (data, pairRefs) => {
    await uploadData(data, fetchDataHandler, pairRefs)
  }, [])

  return {
    pairs,
    notesExist,
    fetchData: fetchDataHandler,
    clearData: clearHandler,
    uploadData: uploadHandler,
  }
}

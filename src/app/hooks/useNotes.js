// src/app/hooks/useNotes.js

import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'

const fetchNotes = async (startDate, endDate) => {
  try {
    const response = await api.get(`/notes?startDate=${startDate}&endDate=${endDate}`)
    return response.data
  } catch (error) {
    if (error.response && error.response.status === 500) {
      throw new Error('Database connection error')
    }
    throw error
  }
}

export const useNotes = (startDate, endDate) => {
  return useQuery({
    queryKey: ['notes', startDate, endDate],
    queryFn: () => fetchNotes(startDate, endDate),
    retry: false,
  })
}

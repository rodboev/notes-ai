// src/app/hooks/useNotes.js

import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'

const fetchNotes = async (startDate, endDate) => {
  try {
    const response = await api.get(`/notes?startDate=${startDate}&endDate=${endDate}`)
    return response.data
  } catch (error) {
    if (error.response && error.response.status === 500) {
      const errorMessage = error.response.data.message || 'Unknown database error'
      console.error('Database error:', errorMessage)
      throw new Error(errorMessage)
    }
    throw error
  }
}

export const useNotes = (startDate, endDate) => {
  return useQuery({
    queryKey: ['notes', startDate, endDate],
    queryFn: () => fetchNotes(startDate, endDate),
    retry: (failureCount, error) => {
      // Only retry if the error is from the database
      return error.message.includes('Database Error')
    },
    retryDelay: 1000, // Retry after 1 second
  })
}

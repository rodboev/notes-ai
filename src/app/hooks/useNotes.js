// src/app/hooks/useNotes.js

import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'

const fetchNotes = async (startDate, endDate) => {
  try {
    const response = await api.get(`/notes?startDate=${startDate}&endDate=${endDate}`)
    return response.data
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      if (error.response.status === 500) {
        const errorMessage = error.response.data.message || 'Unknown database error'
        console.error('Database error:', errorMessage)
        throw new Error(`Database Error: ${errorMessage}`)
      }
      console.error('Server error:', error.response.status, error.response.data)
      throw new Error(`Server Error: ${error.response.status}`)
    }
    if (error.request) {
      // The request was made but no response was received
      console.error('Network error:', error.request)
      throw new Error('Network Error: No response received')
    }
    // Something happened in setting up the request that triggered an Error
    console.error('Request setup error:', error.message)
    throw new Error(`Request Error: ${error.message}`)
  }
}

export const useNotes = (startDate, endDate) => {
  return useQuery({
    queryKey: ['notes', startDate, endDate],
    queryFn: () => fetchNotes(startDate, endDate),
    retry: (failureCount, error) => {
      // Only retry for network errors or specific database errors
      return (
        error.message.includes('Network Error') ||
        (error.message.includes('Database Error') &&
          !error.message.includes('Unknown database error'))
      )
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff with a max of 30 seconds
  })
}

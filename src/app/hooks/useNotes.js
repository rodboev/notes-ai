// src/app/hooks/useNotes.js

import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'

const fetchNotes = async (startDate, endDate) => {
  const response = await api.get(`/notes?startDate=${startDate}&endDate=${endDate}`)
  return response.data
}

export const useNotes = (startDate, endDate) => {
  return useQuery({
    queryKey: ['notes', startDate, endDate],
    queryFn: () => fetchNotes(startDate, endDate),
  })
}

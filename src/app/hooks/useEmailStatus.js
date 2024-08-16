// src/app/hooks/useEmailStatus.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'

const fetchEmailStatus = async (fingerprint) => {
  const response = await api.get(`/status?fingerprint=${fingerprint}`)
  return response.data[fingerprint]
}

const updateEmailStatus = async ({ fingerprint, status }) => {
  return api.patch('/status', { fingerprint, status })
}

export const useEmailStatus = (fingerprint) => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['emailStatus', fingerprint],
    queryFn: () => fetchEmailStatus(fingerprint),
  })

  const mutation = useMutation({
    mutationFn: updateEmailStatus,
    onSuccess: () => {
      queryClient.invalidateQueries(['emailStatus', fingerprint])
    },
  })

  return {
    ...query,
    updateStatus: mutation.mutate,
  }
}

// src/app/hooks/useEmailStatus.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'

const fetchEmailStatuses = async (fingerprints) => {
  const response = await api.get(`/status?fingerprints=${fingerprints.join(',')}`)
  return response.data
}

const updateEmailStatus = async ({ fingerprint, status }) => {
  return api.patch('/status', { fingerprint, status })
}

export const useEmailStatuses = (fingerprints) => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['emailStatuses', fingerprints],
    queryFn: () => fetchEmailStatuses(fingerprints),
  })

  const mutation = useMutation({
    mutationFn: updateEmailStatus,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['emailStatuses', fingerprints], (oldData) => ({
        ...oldData,
        [variables.fingerprint]: variables.status,
      }))
    },
  })

  return {
    ...query,
    updateStatus: mutation.mutate,
  }
}

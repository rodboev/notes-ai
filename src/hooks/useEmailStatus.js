// src/app/hooks/useEmailStatus.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'

const fetchEmailStatuses = async (fingerprints) => {
  if (!fingerprints || fingerprints.length === 0) return {}
  const response = await api.get(`/status?fingerprints=${fingerprints.join(',')}`)
  return response.data
}

const updateEmailStatus = async ({ fingerprint, status }) => {
  const response = await api.patch('/status', { fingerprint, status })
  return response.data
}

export const useEmailStatuses = (fingerprints) => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['emailStatuses', fingerprints],
    queryFn: () => fetchEmailStatuses(fingerprints),
    enabled: fingerprints.length > 0,
  })

  const mutation = useMutation({
    mutationFn: updateEmailStatus,
    onMutate: async (variables) => {
      await queryClient.cancelQueries(['emailStatuses', fingerprints])
      const previousStatuses = queryClient.getQueryData(['emailStatuses', fingerprints])
      queryClient.setQueryData(['emailStatuses', fingerprints], (old) => ({
        ...old,
        [variables.fingerprint]: variables.status,
      }))
      return { previousStatuses }
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['emailStatuses', fingerprints], context.previousStatuses)
    },
    onSettled: () => {
      queryClient.invalidateQueries(['emailStatuses', fingerprints])
    },
  })

  return {
    ...query,
    updateStatus: mutation.mutate,
  }
}

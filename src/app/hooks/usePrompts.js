// src/app/hooks/usePrompts.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'

const fetchPrompts = async () => {
  const response = await api.get('/prompts')
  return response.data
}

const updatePrompts = async (updatedPrompts) => {
  const response = await api.patch('/prompts', updatedPrompts)
  return response.data
}

export const usePrompts = () => {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['prompts'],
    queryFn: fetchPrompts,
  })

  const mutation = useMutation({
    mutationFn: updatePrompts,
    onSuccess: (data) => {
      queryClient.setQueryData(['prompts'], data)
    },
  })

  return {
    ...query,
    updatePrompts: mutation.mutate,
    isUpdating: mutation.isLoading,
  }
}

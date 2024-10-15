// src/app/hooks/useSendEmail.js

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'

const sendEmail = async ({ to, subject, content, fingerprint }) => {
  if (import.meta.env.VITE_NODE_ENV === 'production') {
    const response = await api.post('/send-email', { email: to, subject, content, fingerprint })
    return response.data
  }

  // Simulate sending for non-production environments
  await new Promise((resolve) => setTimeout(resolve, 800))
  return { status: 'success', sentAt: new Date().toISOString() }
}

export const useSendEmail = (fingerprint) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: sendEmail,
    onSuccess: () => {
      queryClient.invalidateQueries(['emailStatuses', [fingerprint]])
    },
  })
}

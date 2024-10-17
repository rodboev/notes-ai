// src/app/hooks/useSendFeedback.js

import { useMutation } from '@tanstack/react-query'
import api from '../utils/api'

const sendFeedback = async ({ feedback, note, email }) => {
  const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === 'production'

  // // Simulate sending for non-production environments
  // await new Promise((resolve) => setTimeout(resolve, 800))
  // return { message: 'Feedback sent successfully' }

  const response = await api.post('/send-feedback', { feedback, note, email })
  return response.data
}

export const useSendFeedback = () => {
  return useMutation({
    mutationFn: sendFeedback,
    onSuccess: (data) => {
      console.log('Feedback sent successfully:', data)
    },
    onError: (error) => {
      console.error('Error sending feedback:', error)
    },
  })
}

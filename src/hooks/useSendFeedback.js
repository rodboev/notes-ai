// src/app/hooks/useSendFeedback.js

import { useMutation } from '@tanstack/react-query'
import api from '../utils/api'
import dotenv from 'dotenv'
dotenv.config()

const sendFeedback = async ({ feedback, note, subject, email }) => {
  const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === 'production'

  if (isProduction) {
    const response = await api.post('/send-feedback', { feedback, note, subject, email })
    return response.data
  } else {
    // Simulate sending for non-production environments
    await new Promise((resolve) => setTimeout(resolve, 800))
    return { message: 'Feedback sent successfully' }
  }
}

export const useSendFeedback = () => {
  return useMutation({
    mutationFn: sendFeedback,
  })
}

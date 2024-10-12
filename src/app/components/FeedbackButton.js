// src/app/components/FeedbackButton.js

import { useState, useEffect } from 'react'
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/16/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import SendIcon from './Icons/SendIcon-v1'
import { motion, AnimatePresence } from 'framer-motion'
import { useSendFeedback } from '../hooks/useSendFeedback'

const FeedbackInput = ({ value, onChange, disabled }) => (
  <AnimatePresence>
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 'auto', opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ overflow: 'hidden' }}
    >
      <input
        type="text"
        value={value}
        onChange={onChange}
        className={`mr-2 w-[calc(8rem+11vw)] rounded border-2 p-1.5 px-3 ${
          disabled ? 'cursor-not-allowed bg-gray-100' : ''
        }`}
        placeholder="Enter feedback"
        disabled={disabled}
      />
    </motion.div>
  </AnimatePresence>
)

const FeedbackButton = ({ note, email, subject }) => {
  const [feedbackFieldVisible, setFeedbackFieldVisible] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const sendFeedbackMutation = useSendFeedback()

  useEffect(() => {
    if (sendFeedbackMutation.isSuccess) {
      setIsSubmitting(false)
    } else if (sendFeedbackMutation.isError) {
      setIsSubmitting(false)
    }
  }, [sendFeedbackMutation.isSuccess, sendFeedbackMutation.isError])

  const handleFeedbackClick = async () => {
    if (!feedbackFieldVisible) {
      setFeedbackFieldVisible(true)
      return
    }

    if (isSubmitting || sendFeedbackMutation.isSuccess) return

    setIsSubmitting(true)
    try {
      await sendFeedbackMutation.mutateAsync({
        feedback: feedbackText,
        note,
        subject,
        email,
      })
    } catch (error) {
      console.error('Error sending feedback:', error)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-2 flex items-center justify-end">
      {(feedbackFieldVisible || sendFeedbackMutation.isSuccess) && (
        <FeedbackInput
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          disabled={isSubmitting || sendFeedbackMutation.isSuccess}
        />
      )}

      {!feedbackFieldVisible && !sendFeedbackMutation.isSuccess && (
        <button
          onClick={handleFeedbackClick}
          className="btn inline-block w-fit bg-neutral-500 text-white"
          type="button"
        >
          Send feedback
        </button>
      )}

      {feedbackFieldVisible && !isSubmitting && sendFeedbackMutation.isIdle && (
        <button
          onClick={handleFeedbackClick}
          className="btn inline-block w-fit bg-neutral-500 text-white"
          type="button"
        >
          <SendIcon className="mr-3 h-5 w-5" />
          <span>Send</span>
        </button>
      )}

      {(isSubmitting || sendFeedbackMutation.isLoading) && (
        <button
          disabled
          className="btn inline-block w-fit cursor-not-allowed bg-neutral-500 text-white"
          type="button"
        >
          <SpinnerIcon className="mr-3 h-6 w-6" />
          <span>Sending</span>
        </button>
      )}

      {sendFeedbackMutation.isSuccess && (
        <button
          disabled
          className="btn inline-block w-fit cursor-not-allowed border-2 border-green-600 bg-white"
          type="button"
        >
          <CheckIcon className="-ml-2 mr-1.5 h-8 w-8 text-green-600" />
          <span>Sent</span>
        </button>
      )}

      {sendFeedbackMutation.isError && (
        <button
          onClick={handleFeedbackClick}
          className="btn inline-block w-fit border-2 border-red-600"
          type="button"
        >
          <ExclamationTriangleIcon className="-ml-0.5 mr-2.5 h-6 w-6 text-red-600" />
          <span>Try again</span>
        </button>
      )}
    </div>
  )
}

export default FeedbackButton

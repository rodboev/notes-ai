// src/app/components/FeedbackButton.js

import { useState } from 'react'
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
          disabled ? 'cursor-not-allowed' : ''
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
  const sendFeedbackMutation = useSendFeedback()

  const handleFeedbackClick = async () => {
    if (!feedbackFieldVisible) {
      setFeedbackFieldVisible(true)
      return
    }

    if (sendFeedbackMutation.isLoading || sendFeedbackMutation.isSuccess) return

    try {
      await sendFeedbackMutation.mutateAsync({
        feedback: feedbackText,
        note,
        subject,
        email,
      })
    } catch (error) {
      console.error('Error sending feedback:', error)
    }
  }

  return (
    <div className="mx-2 flex items-center justify-end">
      {feedbackFieldVisible && (
        <FeedbackInput
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          disabled={sendFeedbackMutation.isLoading || sendFeedbackMutation.isSuccess}
        />
      )}

      {!feedbackFieldVisible && (
        <button
          onClick={handleFeedbackClick}
          className="btn inline-block w-fit bg-neutral-500 text-white"
        >
          Send feedback
        </button>
      )}

      {feedbackFieldVisible && sendFeedbackMutation.isIdle && (
        <button
          onClick={handleFeedbackClick}
          className="btn inline-block w-fit bg-neutral-500 text-white"
        >
          <SendIcon className="mr-3 h-5 w-5" />
          <span>Send</span>
        </button>
      )}

      {sendFeedbackMutation.isLoading && (
        <button
          disabled
          className="btn inline-block w-fit cursor-not-allowed bg-neutral-500 text-white"
        >
          <SpinnerIcon className="mr-3 h-6 w-6" />
          <span>Sending</span>
        </button>
      )}

      {sendFeedbackMutation.isSuccess && (
        <button
          disabled
          className="btn inline-block w-fit cursor-not-allowed border-2 border-green-600 bg-white"
        >
          <CheckIcon className="-ml-2 mr-1.5 h-8 w-8 text-green-600" />
          <span>Sent</span>
        </button>
      )}

      {sendFeedbackMutation.isError && (
        <button
          onClick={handleFeedbackClick}
          className="btn inline-block w-fit border-2 border-red-600"
        >
          <ExclamationTriangleIcon className="-ml-0.5 mr-2.5 h-6 w-6 text-red-600" />
          <span>Try again</span>
        </button>
      )}
    </div>
  )
}

export default FeedbackButton

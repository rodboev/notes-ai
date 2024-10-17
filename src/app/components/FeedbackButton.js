// src/app/components/FeedbackButton.js

import { useState, useEffect, useRef } from 'react'
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/16/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import SendIcon from './Icons/SendIcon'
import { motion, AnimatePresence } from 'framer-motion'
import { useSendFeedback } from '../hooks/useSendFeedback'

const FeedbackInput = ({ value, onChange, disabled, inputRef }) => (
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
        className={`mr-2 w-60 rounded border-2 p-1.5 px-3 ${
          disabled ? 'cursor-not-allowed bg-gray-100' : ''
        }`}
        placeholder="Enter feedback"
        disabled={disabled}
        ref={inputRef}
      />
    </motion.div>
  </AnimatePresence>
)

const FeedbackButton = ({ note, email }) => {
  const [feedbackFieldVisible, setFeedbackFieldVisible] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const sendFeedbackMutation = useSendFeedback()
  const inputRef = useRef(null)

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
      setTimeout(() => inputRef.current?.focus(), 0)
      return
    }

    if (isSubmitting || sendFeedbackMutation.isSuccess) return

    if (!feedbackText.trim()) {
      inputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      await sendFeedbackMutation.mutateAsync({
        feedback: feedbackText,
        note,
        email,
      })
    } catch (error) {
      console.error('Error sending feedback:', error)
      setIsSubmitting(false)
    }
  }

  const isButtonDisabled = !feedbackText.trim() || isSubmitting || sendFeedbackMutation.isSuccess

  return (
    <div className="mx-2 hidden items-center justify-end 2xl:flex">
      {(feedbackFieldVisible || sendFeedbackMutation.isSuccess) && (
        <FeedbackInput
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          disabled={isSubmitting || sendFeedbackMutation.isSuccess}
          inputRef={inputRef}
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

      {feedbackFieldVisible &&
        !isSubmitting &&
        (sendFeedbackMutation.isIdle || sendFeedbackMutation.isError) && (
          <button
            onClick={handleFeedbackClick}
            className={`btn inline-block w-fit ${
              isButtonDisabled
                ? 'cursor-not-allowed bg-neutral-500 text-white opacity-60'
                : 'bg-neutral-500 text-white'
            }`}
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
          <SpinnerIcon className="mr-1 h-6 w-6" />
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
    </div>
  )
}

export default FeedbackButton

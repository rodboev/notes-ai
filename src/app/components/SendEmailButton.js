// src/app/components/SendEmailButton.js

import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/16/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import { useSendEmail } from '../hooks/useSendEmail'
import { useState, useEffect } from 'react'

const SendEmailButton = ({
  fingerprint,
  subject,
  getEmailContent,
  onEmailSent,
  emailStatus,
  updateStatus,
}) => {
  const [isSending, setIsSending] = useState(false)
  const to = 'a.dallas@libertypestnyc.com, r.boev@libertypestnyc.com'

  const sendEmailMutation = useSendEmail(fingerprint)

  useEffect(() => {
    if (emailStatus?.status !== 'sending') {
      setIsSending(false)
    }
  }, [emailStatus])

  const sendEmail = async () => {
    const content = getEmailContent()
    setIsSending(true)

    try {
      updateStatus({ fingerprint, status: { status: 'sending' } })
      const result = await sendEmailMutation.mutateAsync({
        to,
        subject,
        content,
        fingerprint,
      })

      console.log('Email sent successfully!')
      updateStatus({
        fingerprint,
        status: {
          status: 'success',
          sentAt: new Date().toISOString(),
          subject,
          content,
          to,
        },
      })
      onEmailSent()
    } catch (error) {
      console.error('Error sending email:', error)
      updateStatus({ fingerprint, status: { status: 'error', error: error.message } })
    } finally {
      setIsSending(false)
    }
  }

  if (emailStatus?.status === 'success') {
    return (
      <button
        disabled
        className="btn flex cursor-not-allowed border-2 border-green-600 bg-white !py-0"
        type="button"
      >
        <CheckIcon className="-m-2.5 mr-1 h-8 w-8 text-green-600" />
        <span>Email sent</span>
      </button>
    )
  }

  if (isSending || emailStatus?.status === 'sending' || sendEmailMutation.isLoading) {
    return (
      <button disabled className="btn-teal flex cursor-not-allowed" type="button">
        <SpinnerIcon className="-m-1 mr-2" />
        <span>Sending email</span>
      </button>
    )
  }

  if (sendEmailMutation.isError || emailStatus?.status === 'error') {
    return (
      <button onClick={sendEmail} className="btn flex border-2 border-red-600" type="button">
        <ExclamationTriangleIcon className="-m-2 mr-1 h-8 w-8 !py-0 text-red-600" />
        <span>Try again</span>
      </button>
    )
  }

  return (
    <button onClick={sendEmail} className="btn-teal flex" type="button">
      <span>Send email</span>
    </button>
  )
}

export default SendEmailButton

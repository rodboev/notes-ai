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
  const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === 'production'
  const to = isProduction
    ? 'a.dallas@libertypestnyc.com, r.boev@libertypestnyc.com'
    : 'r.boev@libertypestnyc.com'

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
      >
        <CheckIcon className="-m-2 mr-1.5 h-8 w-8 text-green-600" />
        <span>Email sent</span>
      </button>
    )
  } else if (isSending || emailStatus?.status === 'sending' || sendEmailMutation.isLoading) {
    return (
      <button disabled className="btn-teal flex cursor-not-allowed">
        <SpinnerIcon className="-m-1 mr-2" />
        <span>Sending email</span>
      </button>
    )
  } else if (sendEmailMutation.isError || emailStatus?.status === 'error') {
    return (
      <button onClick={sendEmail} className="btn flex border-2 border-red-600">
        <ExclamationTriangleIcon className="-m-2 mr-1 h-8 w-8 !py-0 text-red-600" />
        <span>Try again</span>
      </button>
    )
  } else {
    return (
      <button onClick={sendEmail} className="btn-teal flex">
        <span>Send email</span>
      </button>
    )
  }
}

export default SendEmailButton

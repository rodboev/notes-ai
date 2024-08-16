// src/app/components/SendEmailButton.js

import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/16/solid'
import SpinnerIcon from './Icons/SpinnerIcon'
import { useSendEmail } from '../hooks/useSendEmail'

const SendEmailButton = ({
  fingerprint,
  subject,
  getEmailContent,
  onEmailSent,
  emailStatus,
  updateStatus,
}) => {
  const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === 'production'
  const to = isProduction
    ? 'a.dallas@libertypestnyc.com, r.boev@libertypestnyc.com'
    : 'r.boev@libertypestnyc.com'

  const sendEmailMutation = useSendEmail(fingerprint)

  const sendEmail = async () => {
    const content = getEmailContent()

    updateStatus({ fingerprint, status: 'sending' })

    try {
      const result = await sendEmailMutation.mutateAsync({
        to,
        subject,
        content,
        fingerprint,
      })

      console.log('Email sent successfully!')
      updateStatus({ fingerprint, status: result.status })
      onEmailSent()
    } catch (error) {
      console.error('Error sending email:', error)
      updateStatus({ fingerprint, status: 'error', error: error.message })
    }
  }

  const isDisabled = ['sending', 'success'].includes(emailStatus?.status)

  if (isDisabled) {
    return (
      <button
        disabled
        className="btn mr-2 flex cursor-not-allowed border-2 border-green-600 bg-white !py-0"
      >
        <CheckIcon className="-m-2 mr-1.5 h-8 w-8 text-green-600" />
        <span>Email sent</span>
      </button>
    )
  }

  if (sendEmailMutation.isLoading) {
    return (
      <button disabled className="btn-teal mr-2 flex cursor-not-allowed">
        <SpinnerIcon className="-m-1 mr-2" />
        <span>Sending email</span>
      </button>
    )
  }

  if (sendEmailMutation.isError) {
    return (
      <button onClick={sendEmail} className="btn mr-2 flex border-2 border-red-600">
        <ExclamationTriangleIcon className="-m-2 mr-1 h-8 w-8 !py-0 text-red-600" />
        <span>Try again</span>
      </button>
    )
  }

  return (
    <button onClick={sendEmail} className="btn-teal mr-2 flex">
      <span>Send email</span>
    </button>
  )
}

export default SendEmailButton

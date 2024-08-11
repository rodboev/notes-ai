// src/app/components/SendEmailButton.js

import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/16/solid'
import SpinnerIcon from './Icons/SpinnerIcon'

const SendEmailButton = ({
  fingerprint,
  subject,
  getEmailContent,
  onEmailSent,
  emailStatus,
  updateEmailStatus,
}) => {
  const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === 'production'
  const to = isProduction
    ? 'a.dallas@libertypestnyc.com, r.boev@libertypestnyc.com'
    : 'r.boev@libertypestnyc.com'

  const sendEmail = async () => {
    const reallySend = isProduction
    const content = getEmailContent()

    updateEmailStatus({ status: 'sending' })
    if (reallySend) {
      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: to, subject, content, fingerprint }),
        })
        if (response.ok) {
          const data = await response.json()
          console.log('Email sent successfully!')
          updateEmailStatus(data.status)
          onEmailSent()
        } else {
          console.warn('Failed to send email.')
          updateEmailStatus({ status: 'error' })
        }
      } catch (error) {
        console.error('Error sending email:', error)
        updateEmailStatus({ status: 'error', error: error.message })
      }
    } else {
      // Simulate sending for non-production environments
      setTimeout(() => {
        updateEmailStatus({
          status: 'success',
          sentAt: new Date().toISOString(),
          subject,
          content,
          to,
        })
        onEmailSent()
      }, 800)
    }
  }

  return (
    <button
      onClick={() => {
        ;(emailStatus.status === undefined || emailStatus.status === 'error') && sendEmail()
      }}
      disabled={!(emailStatus.status === undefined || emailStatus.status === 'error')}
      className={`mr-2 ${
        emailStatus.status === undefined
          ? 'btn-teal flex'
          : emailStatus.status === 'sending'
            ? 'btn-teal flex cursor-not-allowed'
            : emailStatus.status === 'success'
              ? 'btn flex cursor-not-allowed border-2 border-green-600 bg-white !py-0'
              : emailStatus.status === 'error'
                ? 'btn flex border-2 border-red-600'
                : null
      }`}
    >
      {emailStatus.status === undefined ? (
        <span>Send email</span>
      ) : emailStatus.status === 'sending' ? (
        <>
          <SpinnerIcon className="-m-1 mr-2" />
          <span>Send email</span>
        </>
      ) : emailStatus.status === 'success' ? (
        <>
          <CheckIcon className="-m-2 mr-1.5 h-8 w-8 text-green-600" />
          <span>Email sent</span>
        </>
      ) : emailStatus.status === 'error' ? (
        <>
          <ExclamationTriangleIcon className="-m-2 mr-1 h-8 w-8 !py-0 text-red-600" />
          <span>Try again</span>
        </>
      ) : null}
    </button>
  )
}

export default SendEmailButton

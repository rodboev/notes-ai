// src/app/api/send-feedback/route.js

import dotenv from 'dotenv'
import { createTransporter, sendEmail } from '@/utils/emailUtils'

dotenv.config({ path: '.env.local' })

export const POST = async (req, res) => {
  const { feedback, note, email, subject } = await req.json()
  const { GMAIL_USER, FEEDBACK_RECIPIENT_EMAIL } = process.env

  if (!feedback) {
    console.error('Missing field: feedback')
    res.status(400).json({ error: 'Missing field', details: ['feedback'] })
    return
  }

  try {
    const transporter = await createTransporter(process.env)

    const mailOptions = {
      from: GMAIL_USER,
      to: FEEDBACK_RECIPIENT_EMAIL,
      subject: 'New Feedback Received',
      html: `
        <p><strong>Feedback:</strong> ${feedback}</p>
        <hr />
        <p><strong>Email:</strong></p>
        <p>Subject: ${subject || ''}</p>
        <p>${email || ''}</p>
        <hr />
        <p><strong>Note:</strong> ${note || ''}</p>
      `,
    }

    await sendEmail(transporter, mailOptions)
    console.log('Feedback email sent successfully')

    res.status(200).json({ message: 'Feedback sent successfully' })
  } catch (error) {
    console.error('Error sending feedback:', error)
    res.status(500).json({ error: 'Error sending feedback', details: error.message })
  }
}

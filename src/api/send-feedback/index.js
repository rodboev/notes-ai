// src/app/api/send-feedback/route.js

import dotenv from 'dotenv'
import { createTransporter, sendEmail } from '@/utils/emailUtils'

dotenv.config()

export default {
  async POST(req) {
    const { feedback, note, email, subject } = await req.json()
    const { GMAIL_USER, FEEDBACK_RECIPIENT_EMAIL } = process.env

    if (!feedback) {
      console.error('Missing field: feedback')
      return new Response(JSON.stringify({ error: 'Missing field', details: ['feedback'] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
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

      return new Response(JSON.stringify({ message: 'Feedback sent successfully' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      console.error('Error sending feedback:', error)
      return new Response(
        JSON.stringify({ error: 'Error sending feedback', details: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
  },
}

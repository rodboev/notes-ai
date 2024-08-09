// src/app/api/send-feedback/route.js

import { NextResponse } from 'next/server'
import dotenv from 'dotenv'
import { createTransporter, sendEmail } from '../../utils/emailUtils'

dotenv.config()

export async function POST(req) {
  const { feedback, note, email, subject } = await req.json()
  const { GMAIL_USER, FEEDBACK_RECIPIENT_EMAIL } = process.env

  if (!feedback) {
    console.error('Missing field: feedback')
    return NextResponse.json({ error: 'Missing field', details: ['feedback'] }, { status: 400 })
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
        <p><strong>Email:</strong><p>
				<p>Subject: ${subject || ''}<p>
				<p>${email || ''}</p>
				<hr />
        <p><strong>Note:</strong> ${note || ''}</p>
      `,
    }

    await sendEmail(transporter, mailOptions)
    console.log('Feedback email sent successfully')

    return NextResponse.json({ message: 'Feedback sent successfully' })
  } catch (error) {
    console.error('Error sending feedback:', error)
    return NextResponse.json(
      { error: 'Error sending feedback', details: error.message },
      { status: 500 },
    )
  }
}

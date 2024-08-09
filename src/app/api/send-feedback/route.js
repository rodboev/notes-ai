// src/app/api/send-feedback/route.js

import { NextResponse } from 'next/server'
import dotenv from 'dotenv'
import { createTransporter, sendEmail } from '../../utils/emailUtils'

dotenv.config()

export async function POST(req) {
  const { GMAIL_USER, FEEDBACK_RECIPIENT_EMAIL } = process.env

  let feedback, fingerprint
  try {
    const body = await req.json()
    ;({ feedback, fingerprint } = body)
  } catch (error) {
    console.error('Error parsing request body:', error)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!feedback || !fingerprint) {
    const missingFields = ['feedback', 'fingerprint'].filter((field) => !eval(field))
    console.error('Missing fields:', missingFields.join(', '))
    return NextResponse.json({ error: 'Missing field', details: missingFields }, { status: 400 })
  }

  try {
    const transporter = await createTransporter(process.env)

    const mailOptions = {
      from: GMAIL_USER,
      to: FEEDBACK_RECIPIENT_EMAIL,
      subject: 'New Feedback Received',
      html: `
        <h2>New Feedback</h2>
        <p><strong>Fingerprint:</strong> ${fingerprint}</p>
        <p><strong>Feedback:</strong> ${feedback}</p>
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

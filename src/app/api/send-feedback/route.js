// src/app/api/send-feedback/route.js

import { NextResponse } from 'next/server'
import dotenv from 'dotenv'
import { createTransporter, sendEmail } from '../../utils/emailUtils'

dotenv.config()

export async function POST(req) {
  console.log('Received feedback request')
  const { feedback, note, email } = await req.json()
  console.log('Feedback data:', { feedback, note, email })
  const { GMAIL_USER, FEEDBACK_RECIPIENT_EMAIL } = process.env

  const requiredFields = ['feedback', 'note', 'email']
  const missingFields = requiredFields.filter((field) => !eval(field))

  if (missingFields.length > 0) {
    console.error(`Missing fields: ${missingFields.join(', ')}`)
    return NextResponse.json({ error: 'Missing fields', details: missingFields }, { status: 400 })
  }

  try {
    const transporter = await createTransporter(process.env)

    const mailOptions = {
      from: GMAIL_USER,
      to: FEEDBACK_RECIPIENT_EMAIL,
      subject: 'New Feedback Received',
      html: `
        <p><strong>Feedback for the following email:</strong></p>
        
        <p>${feedback}</p>
        <hr />
        <p>Subject: ${email.subject || ''}</p>
        <p>${email.body || ''}</p>
        <hr />
        <p><strong>Note used for the email:</strong></p>
        <p>
          Code: ${note.code}<br>
          Company: ${note.company} - <a href="https://app.pestpac.com/location/detail.asp?LocationID=${note.locationID}">${note.locationCode}</a>
        </p>
        <p>${note.content}</p>
        <p>Tech: ${note.tech}</p>
      `,
    }

    console.log('Sending email with options:', mailOptions)
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

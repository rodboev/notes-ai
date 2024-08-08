// src/app/api/send-email/route.js

import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { google } from 'googleapis'
import dotenv from 'dotenv'
import { loadStatuses, saveStatuses } from '../status/route' // Import these functions

dotenv.config()

export async function POST(req) {
  const {
    GMAIL_USER,
    SERVICE_ACCOUNT_CLIENT_EMAIL,
    SERVICE_ACCOUNT_PRIVATE_KEY,
    SERVICE_ACCOUNT_CLIENT_ID,
  } = process.env

  console.log('GMAIL_USER:', GMAIL_USER)

  let email, subject, content, fingerprint
  try {
    const body = await req.json()
    ;({ email, subject, content, fingerprint } = body)
  } catch (error) {
    console.error('Error parsing request body:', error)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  console.log('Received parameters:', {
    email,
    subject,
    content: content.substring(0, 100) + '...',
    fingerprint,
  })

  if (!email || !subject || !content || !fingerprint) {
    const missingFields = ['email', 'subject', 'content', 'fingerprint'].filter(
      (field) => !eval(field),
    )
    console.error('Missing fields:', missingFields.join(', '))
    return NextResponse.json({ error: 'Missing field', details: missingFields }, { status: 400 })
  }

  try {
    const oAuth2Client = new google.auth.JWT(
      SERVICE_ACCOUNT_CLIENT_EMAIL,
      null,
      SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/gm, '\n'),
      ['https://mail.google.com/'],
      GMAIL_USER,
    )

    await oAuth2Client.authorize()
    const accessToken = await (await oAuth2Client.getAccessToken()).token

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: GMAIL_USER,
        clientId: SERVICE_ACCOUNT_CLIENT_ID,
        accessToken: accessToken,
      },
    })

    const mailOptions = {
      from: GMAIL_USER,
      to: email,
      subject: subject,
      html: content,
    }

    await transporter.sendMail(mailOptions)
    console.log('Email sent successfully')

    const emailData = {
      status: 'success',
      sentAt: new Date().toISOString(),
      subject,
      content,
      to: email,
    }

    // Update status directly using functions from status/route.js
    const existingStatuses = await loadStatuses()
    const updatedStatuses = { ...existingStatuses, [fingerprint]: emailData }
    await saveStatuses(updatedStatuses)

    return NextResponse.json({ message: 'Email sent successfully', status: emailData })
  } catch (error) {
    console.error('Error sending email:', error)

    // Update status to error
    const existingStatuses = await loadStatuses()
    const errorStatus = {
      status: 'error',
      sentAt: new Date().toISOString(),
      subject,
      content,
      to: email,
      error: error.message,
    }
    const updatedStatuses = { ...existingStatuses, [fingerprint]: errorStatus }
    await saveStatuses(updatedStatuses)

    return NextResponse.json(
      { error: 'Error sending email', details: error.message, status: errorStatus },
      { status: 500 },
    )
  }
}

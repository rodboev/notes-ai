import nodemailer from 'nodemailer'
import { google } from 'googleapis'
import dotenv from 'dotenv'
import { loadStatuses, saveStatus } from '@/api/status'

dotenv.config({ path: '.env.local' })

export const POST = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

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
    res.status(400).json({ error: 'Invalid request body' })
    return
  }

  console.log('Received parameters:', {
    email,
    subject,
    content: `${content.substring(0, 100)}...`,
    fingerprint,
  })

  if (!email || !subject || !content || !fingerprint) {
    const missingFields = ['email', 'subject', 'content', 'fingerprint'].filter(
      (field) => !eval(field),
    )
    console.error('Missing fields:', missingFields.join(', '))
    res.status(400).json({ error: 'Missing field', details: missingFields })
    return
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

    // Update status using saveStatus function
    await saveStatus(fingerprint, emailData)

    res.status(200).json({ message: 'Email sent successfully', status: emailData })
  } catch (error) {
    console.error('Error sending email:', error)

    // Update status to error using saveStatus function
    const errorStatus = {
      status: 'error',
      sentAt: new Date().toISOString(),
      subject,
      content,
      to: email,
      error: error.message,
    }
    await saveStatus(fingerprint, errorStatus)

    res
      .status(500)
      .json({ error: 'Error sending email', details: error.message, status: errorStatus })
  }
}

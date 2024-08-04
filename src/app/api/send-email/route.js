import nodemailer from 'nodemailer'
import { google } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

async function parseRequestBody(req) {
  const chunks = []

  for await (const chunk of req.body) {
    chunks.push(chunk)
  }

  const data = Buffer.concat(chunks).toString()
  return JSON.parse(data)
}

export async function POST(req) {
  const {
    GMAIL_USER,
    SERVICE_ACCOUNT_CLIENT_EMAIL,
    SERVICE_ACCOUNT_PRIVATE_KEY,
    SERVICE_ACCOUNT_CLIENT_ID,
  } = process.env

  // Log retrieved GMAIL_USER for verification
  console.log('GMAIL_USER:', GMAIL_USER)

  let email, subject, content

  try {
    const body = await parseRequestBody(req)
    ;({ email, subject, content } = body)
  } catch (error) {
    console.error('Error parsing request body:', error)
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  console.log('Received parameters:', { email, subject, content })

  if (!email || !subject || !content) {
    const missingFields = []
    if (!email) missingFields.push('email')
    if (!subject) missingFields.push('subject')
    if (!content) missingFields.push('content')

    console.error('Missing fields:', missingFields.join(', '))
    return new Response(
      JSON.stringify({ error: 'Missing field', details: missingFields }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }

  async function sendEmail() {
    try {
      const oAuth2Client = new google.auth.JWT(
        SERVICE_ACCOUNT_CLIENT_EMAIL,
        null,
        SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/gm, '\n'), // Correctly format private key
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
        // debug: true,
        // logger: true,
      })

      const mailOptions = {
        from: GMAIL_USER,
        to: email,
        subject: subject,
        html: content,
      }

      await transporter.sendMail(mailOptions)
      console.log('Email sent successfully')

      return new Response(
        JSON.stringify({ message: 'Email sent successfully' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    } catch (error) {
      console.error('Error sending email:', error)
      return new Response(
        JSON.stringify({
          error: 'Error sending email',
          details: error.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }
  }

  return sendEmail()
}

// src/app/utils/emailUtils.js

import nodemailer from 'nodemailer'
import { google } from 'googleapis'

export async function createTransporter(env) {
  const oAuth2Client = new google.auth.JWT(
    env.SERVICE_ACCOUNT_CLIENT_EMAIL,
    null,
    env.SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/gm, '\n'),
    ['https://mail.google.com/'],
    env.GMAIL_USER,
  )
  console.log('Created transporter.')

  await oAuth2Client.authorize()
  const accessToken = await (await oAuth2Client.getAccessToken()).token
  console.log('OAuth2 client authorized.')

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: env.GMAIL_USER,
      clientId: env.SERVICE_ACCOUNT_CLIENT_ID,
      accessToken: accessToken,
    },
  })
}

export async function sendEmail(transporter, mailOptions) {
  const result = await transporter.sendMail(mailOptions)
  console.log('Email sent.')
  return result
}

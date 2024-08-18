// src/app/api/emails/route.js

import OpenAI from 'openai'
import { parse } from 'best-effort-json-parser'
import { firestore } from '../../../firebase.js'
import { readFromDisk, writeToDisk, deleteFromDisk } from '../../utils/diskStorage'
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore'
import { timestamp } from '../../utils/timestamp'
import dotenv from 'dotenv'
import { getPrompts } from '../prompts/route.js'
import { firestoreGetDoc, firestoreBatchWrite, firestoreSetDoc } from '../../utils/firestoreHelper'

dotenv.config()
const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === 'production'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const port = process.env.PORT

const chunkArray = (array, chunkSize) => {
  const chunks = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

async function loadEmails() {
  try {
    const diskEmails = await readFromDisk('emails.json')
    if (diskEmails) {
      console.log(`${timestamp()} Loaded ${diskEmails.length} emails from disk`)
      return diskEmails
    }

    console.log(`${timestamp()} Emails not on disk, loading from Firestore`)
    const emailsCollection = collection(firestore, 'emails')
    const snapshot = await firestoreGetDoc('emails', 'allEmails')
    const emails = snapshot ? snapshot.emails : []
    console.log(`${timestamp()} Loaded ${emails.length} emails from Firestore`)
    await writeToDisk('emails.json', emails)
    console.log(`${timestamp()} Saved ${emails.length} emails to disk`)
    return emails
  } catch (error) {
    console.warn(`${timestamp()} Error loading emails:`, error)
    return []
  }
}

async function saveEmails(emails) {
  console.warn(`${timestamp()} Saving emails to disk and Firestore`)

  // Check if there are changes compared to the disk version
  const diskEmails = await readFromDisk('emails.json')
  const hasChanges = JSON.stringify(diskEmails) !== JSON.stringify(emails)

  if (hasChanges) {
    // Save to disk using the helper function
    await writeToDisk('emails.json', emails)
    console.log(`${timestamp()} Saved ${emails.length} emails to disk`)

    // Save to Firestore using the helper function
    console.log(`${timestamp()} Changes detected in emails. Triggering Firestore write`)
    await firestoreSetDoc('emails', 'allEmails', { emails })
    console.log(`${timestamp()} Saved ${emails.length} emails to Firestore`)
  } else {
    console.log(`${timestamp()} No changes detected, skipping save operation`)
  }
}

function expand(template, variables) {
  if (typeof template !== 'string') {
    console.warn('Template is not a string:', template)
    return ''
  }
  return template.replace(/{{([^}]+)}}/g, (match, key) => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], variables)
    if (typeof value === 'object' && value.object) {
      return expand(value.object, variables)
    }
    return typeof value === 'string' ? expand(value, variables) : (value ?? match)
  })
}

export async function GET(req) {
  const url = new URL(req.url)
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')
  const fingerprint = url.searchParams.get('fingerprint')
  const fingerprints = url.searchParams.get('fingerprints')
  const requestedFingerprints = fingerprints?.split(',') || []

  console.log(
    `${timestamp()} GET /api/emails request params: startDate=${startDate}, endDate=${endDate}, fingerprint=${fingerprint}, fingerprints=${fingerprints}`,
  )

  let storedEmails = await loadEmails()
  let emailCache = storedEmails.reduce((acc, email) => {
    if (email.fingerprint) {
      acc[email.fingerprint] = email
    }
    return acc
  }, {})

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      let responseComplete = false
      let dataSent = false
      let sentFingerprints = new Set()

      function sendData(data, status) {
        let payload
        if (status === 'stored' || status === 'streaming') {
          // Only stringify if the data isn't already a string
          payload = {
            chunk: typeof data === 'string' ? data : JSON.stringify(data),
            status,
          }
        } else {
          // For 'complete' and 'error' statuses
          payload = { chunk: data, status }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        dataSent = true
      }

      async function streamResponse(chunk) {
        const prompts = await getPrompts()

        if (!prompts.system || !prompts.user) {
          throw new Error('Required prompts not found')
        }

        const systemContent = expand(prompts.system.current || prompts.system.default, prompts)
        const userContent = prompts.user + JSON.stringify(chunk)

        // console.log(`${timestamp()} userContent`, userContent)
        const messages = [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ]

        let stream
        try {
          stream = await openai.chat.completions.create({
            model: isProduction ? 'gpt-4o' : 'gpt-4o-mini',
            stream: true,
            response_format: { type: 'json_object' },
            messages,
            seed: 0,
          })
        } catch (error) {
          console.warn(`${timestamp()} OpenAI API error in streamResponse:`, String(error))
          throw error
        }

        let emailsJson = ''

        for await (const data of stream) {
          const chunk = data.choices[0].delta.content
          const status = data.choices[0].finish_reason
          if (!status) {
            // Streaming response
            emailsJson += chunk
            /*
						console.log(`-------------------------------`)
            console.log(`[1] sendData(${chunk}, 'streaming')`)
            console.log(`-------------------------------`)
						*/
            sendData(chunk, 'streaming')
          } else if (status === 'stop') {
            // Full response end of this streaming chunk
            const emails = parse(emailsJson.trim()).emails || []
            const uniqueNewEmails = emails.filter(
              (email) => !sentFingerprints.has(email.fingerprint),
            )
            if (uniqueNewEmails.length > 0) {
              // sendData({ emails: uniqueNewEmails }, 'streaming')
              uniqueNewEmails.forEach((email) => sentFingerprints.add(email.fingerprint))
            }
            return emails
          }
        }
      }

      try {
        if (fingerprint) {
          // Handle single note refresh (always stream)
          const response = await fetch(
            `http://localhost:${port}/api/notes?fingerprint=${fingerprint}`,
          )
          const note = await response.json()

          if (note.length === 0) {
            throw new Error(`Note not found for fingerprint: ${fingerprint}`)
          }

          // Force refresh the email
          const [generatedEmail] = await streamResponse([note])
          if (generatedEmail) {
            // Update stored emails and cache
            storedEmails = storedEmails.filter((e) => e.fingerprint !== fingerprint)
            storedEmails.push(generatedEmail)
            emailCache[fingerprint] = generatedEmail
            await saveEmails(storedEmails)
          } else {
            throw new Error(`Failed to generate email for fingerprint: ${fingerprint}`)
          }
        } else if (requestedFingerprints.length > 0) {
          // Filter out empty strings from requestedFingerprints
          const validRequestedFingerprints = requestedFingerprints.filter((fp) => fp.trim() !== '')

          // Send stored emails that match the request
          const storedEmailsToSend = storedEmails.filter((email) =>
            validRequestedFingerprints.includes(email.fingerprint),
          )

          if (storedEmailsToSend.length > 0) {
            const uniqueStoredEmails = storedEmailsToSend.filter(
              (email) => !sentFingerprints.has(email.fingerprint),
            )
            if (uniqueStoredEmails.length > 0) {
              /*
							console.log(`-------------------------------`)
              console.log(`[2] sendData({ emails: ${uniqueStoredEmails} }, 'stored')`)
              console.log(`-------------------------------`)
							*/
              sendData({ emails: uniqueStoredEmails }, 'stored')
              uniqueStoredEmails.forEach((email) => sentFingerprints.add(email.fingerprint))
            }
          }

          // Determine which fingerprints need to be fetched
          const fingerprintsToFetch = validRequestedFingerprints.filter((fp) => !emailCache[fp])

          // Debug logging
          // console.log('requestedFingerprints', requestedFingerprints)
          // console.log('validRequestedFingerprints', validRequestedFingerprints)
          // console.log('fingerprintsToFetch', fingerprintsToFetch)

          if (fingerprintsToFetch.length > 0) {
            const response = await fetch(
              `http://localhost:${port}/api/notes?fingerprints=${fingerprintsToFetch.join(',')}`,
            )
            const notesToProcess = await response.json()
            console.log(`${timestamp()} Fetched ${notesToProcess.length} notes to process`)

            if (notesToProcess.length > 0) {
              // Process all notes at once
              const newEmails = await streamResponse(notesToProcess)
              if (newEmails.length > 0) {
                const uniqueNewEmails = newEmails.filter((email) => !emailCache[email.fingerprint])
                storedEmails = [...storedEmails, ...uniqueNewEmails]
                uniqueNewEmails.forEach((email) => {
                  emailCache[email.fingerprint] = email
                })
              }

              await saveEmails(storedEmails)
            } else {
              console.log(`${timestamp()} No new emails to generate`)
            }
          } else {
            console.log(`${timestamp()} All requested emails are already cached`)
          }
        } else {
          throw new Error('Invalid request parameters')
        }

        console.log(`${timestamp()} responseComplete = true`)
        responseComplete = true
        sendData({}, 'complete')
      } catch (error) {
        console.error(`${timestamp()} Error processing emails:`, error)
        sendData({ error: error.message || 'Internal server error' }, 'error')
      } finally {
        if (!dataSent) {
          // If no data was sent, send an empty 'complete' message
          sendData({}, 'complete')
        }
        controller.close()
      }
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

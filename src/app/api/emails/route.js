// src/app/api/emails/route.js

import OpenAI from 'openai'
import { parse } from 'best-effort-json-parser'
import { firestore } from '../../../firebase.js'
import { readFromDisk, writeToDisk } from '../../utils/diskStorage'
import { timestamp } from '../../utils/timestamp'
import { getPrompts } from '../prompts/route.js'
import { firestoreBatchWrite, firestoreGetAllDocs } from '../../utils/firestoreHelper'
import { headers } from 'next/headers'
import { GET as getNotes } from '../notes/route'

const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === 'production'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const NOTES_PER_GROUP = isProduction ? 10 : 3

const chunkArray = (array, chunkSize) => {
  const chunks = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

async function loadEmails() {
  const diskEmails = await readFromDisk('emails.json')
  if (diskEmails) {
    console.log(`${timestamp()} Loaded ${diskEmails.length} emails from disk`)
    return diskEmails
  }

  console.log(`${timestamp()} Emails not on disk, loading from Firestore`)
  const emails = await firestoreGetAllDocs('emails')
  console.log(`${timestamp()} Loaded ${emails.length} emails from Firestore`)
  await writeToDisk('emails.json', emails)
  console.log(`${timestamp()} Saved ${emails.length} emails to disk`)
  return emails
}

async function saveEmails(emails) {
  console.warn(`${timestamp()} Saving emails to disk and Firestore`)

  // Check if there are changes compared to the disk version
  const diskEmails = await readFromDisk('emails.json')
  const hasChanges = JSON.stringify(diskEmails) !== JSON.stringify(emails)

  if (hasChanges) {
    // Save to disk
    await writeToDisk('emails.json', emails)
    console.log(`${timestamp()} Saved ${emails.length} emails to disk`)

    // Save to Firestore
    console.log(`${timestamp()} Changes detected in emails. Triggering Firestore write`)
    const { validOperations, skippedOperations, error } = await firestoreBatchWrite(
      'emails',
      emails,
    )

    if (error) {
      console.error('Error during batch write:', error)
    } else {
      console.log(
        `${timestamp()} Saved ${validOperations} emails to Firestore, skipped ${skippedOperations}`,
      )
    }
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
    return typeof value === 'string' ? expand(value, variables) : (value ?? match)
  })
}

async function fetchWithErrorHandling(searchParams) {
  console.log(`${timestamp()} Attempting to fetch notes with params:`, searchParams)
  try {
    const response = await getNotes({ url: `http://localhost/api/notes?${searchParams}` })
    const notes = await response.json()
    console.log(`${timestamp()} Fetch completed, retrieved ${notes.length} notes`)
    return notes
  } catch (error) {
    console.error(`${timestamp()} Error:`, {
      message: error.message,
      cause: error.cause?.message,
      code: error.cause?.code,
      stack: error.stack,
    })
    throw error
  }
}

export async function GET(req) {
  const headersList = headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'

  // Extract search params from the request URL
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const fingerprint = searchParams.get('fingerprint')
  const fingerprints = searchParams.get('fingerprints')
  const requestedFingerprints = fingerprints?.split(',') || []

  console.log(
    `${timestamp()} GET /api/emails request params: startDate=${startDate}, endDate=${endDate}, fingerprint=${fingerprint}, fingerprints=${fingerprints}`,
  )

  let storedEmails = await loadEmails()
  const emailCache = storedEmails.reduce((acc, email) => {
    if (email.fingerprint) acc[email.fingerprint] = email
    return acc
  }, {})

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      let responseComplete = false
      let dataSent = false
      const sentFingerprints = new Set()

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
            model: 'gpt-4o-2024-08-06',
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
            sendData(chunk, 'streaming')
          } else if (status === 'stop') {
            // Full response end of this streaming chunk
            // The status here tells the front-end to stop concatenating emailsJson, so it can parse streaming objects separately
            sendData('', 'streaming-object-complete')
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
          console.log(`${timestamp()} Fetching note for fingerprint: ${fingerprint}`)
          const note = await fetchWithErrorHandling(`fingerprint=${fingerprint}`)

          if (!note || note.length === 0) {
            throw new Error(`Note not found for fingerprint: ${fingerprint}`)
          }

          // Force refresh the email
          const [generatedEmail] = await streamResponse([note[0]])
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
              sendData({ emails: uniqueStoredEmails }, 'stored')
              uniqueStoredEmails.forEach((email) => sentFingerprints.add(email.fingerprint))
            }
          }

          const fingerprintsToFetch = validRequestedFingerprints.filter((fp) => !emailCache[fp])

          if (fingerprintsToFetch.length > 0) {
            try {
              console.log(
                `${timestamp()} Fetching notes for fingerprints: ${fingerprintsToFetch.join(',')}`,
              )
              const notesToProcess = await fetchWithErrorHandling(
                `fingerprints=${fingerprintsToFetch.join(',')}`,
              )
              console.log(`${timestamp()} Fetched ${notesToProcess.length} notes to process`)

              // Process notes in groups of 10 or less at a time
              const noteGroups = chunkArray(notesToProcess, NOTES_PER_GROUP)
              console.log(
                `${timestamp()} Created ${noteGroups.length} note groups (${NOTES_PER_GROUP} notes each)`,
              )

              for (const [index, noteGroup] of noteGroups.entries()) {
                console.log(`${timestamp()} Processing group ${index + 1} of ${noteGroups.length}`)
                const newEmailGroup = await streamResponse(noteGroup)
                storedEmails = [...storedEmails, ...newEmailGroup]
                newEmailGroup.forEach((email) => {
                  emailCache[email.fingerprint] = email
                })
                console.log(
                  `${timestamp()} Generated ${newEmailGroup.length} new emails in group ${index + 1}`,
                )
                await saveEmails(storedEmails)
              }
            } catch (error) {
              console.error(`${timestamp()} Error fetching or processing notes:`, error)
              const errorDetails = {
                message: error.message,
                cause: error.cause?.message,
                code: error.cause?.code,
                stack: error.stack,
                name: error.name,
              }
              sendData({ error: errorDetails }, 'error')
              controller.close()
              return // Exit the function early
            }
          } else {
            console.log(`${timestamp()} No new emails to generate`)
          }
        } else {
          console.log(`${timestamp()} All requested emails are already cached`)
        }

        console.log(`${timestamp()} responseComplete = true`)
        responseComplete = true
        sendData({}, 'complete')
      } catch (error) {
        console.error(`${timestamp()} Error processing emails:`, error)
        const errorDetails = {
          message: error.message,
          cause: error.cause?.message,
          code: error.cause?.code,
          stack: error.stack,
          name: error.name,
        }
        sendData({ error: errorDetails }, 'error')
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

// src/app/api/emails/route.js

import OpenAI from 'openai'
import { parse } from 'best-effort-json-parser'
import { firestore } from '../../../firebase.js'
import { readFromDisk, writeToDisk, deleteFromDisk } from '../../utils/diskStorage'
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore'
import { chunkArray } from '../../utils/arrayUtils'
import { timestamp } from '../../utils/timestamp'
import dotenv from 'dotenv'
import { getPrompts } from '../prompts/route.js'

dotenv.config()
const isProduction = process.env.NEXT_PUBLIC_NODE_ENV === 'production'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const port = process.env.PORT

async function loadEmails() {
  console.log(`${timestamp()} Attempting to load emails from disk`)
  try {
    const diskEmails = await readFromDisk('emails.json')
    if (diskEmails) {
      console.log(`${timestamp()} Loaded ${diskEmails.length} emails from disk`)
      return diskEmails
    }

    console.log(`${timestamp()} Emails not on disk, loading from Firestore`)
    const emailsCollection = collection(firestore, 'emails')
    const snapshot = await getDocs(emailsCollection)
    const emails = snapshot.docs.map((doc) => doc.data())
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

  // Log the total number of emails
  console.log(`${timestamp()} Total emails: ${emails.length}`)

  // Log each email's date and fingerprint
  emails.forEach((email) => {
    console.log(`${timestamp()} Saving email: date=${email.date}, fingerprint=${email.fingerprint}`)
  })

  // Save to disk
  try {
    await writeToDisk('emails.json', emails)
    console.log(`${timestamp()} Saved ${emails.length} emails to disk`)
  } catch (error) {
    console.warn(`${timestamp()} Error saving emails to disk:`, error)
  }

  // Save to Firestore
  if (!firestore) {
    console.warn(`${timestamp()} Firestore is not initialized`)
    return
  }

  const batch = writeBatch(firestore)
  const emailsCollection = collection(firestore, 'emails')

  let savedCount = 0
  try {
    emails.forEach((email) => {
      if (email.fingerprint) {
        const docRef = doc(emailsCollection, email.fingerprint)
        batch.set(docRef, email)
        savedCount++
      } else {
        console.warn(`${timestamp()} Email without fingerprint:`, email)
      }
    })
    await batch.commit()
    console.log(`${timestamp()} Saved ${savedCount} emails to Firestore`)
  } catch (error) {
    console.warn(`${timestamp()} Error saving emails to Firestore:`, error)
  }
}

async function deletePreviousEmails() {
  try {
    // Delete from Firestore
    const emailsCollection = collection(firestore, 'emails')
    const snapshot = await getDocs(emailsCollection)
    const batch = writeBatch(firestore)
    snapshot.forEach((doc) => {
      batch.delete(doc.ref)
    })
    await batch.commit()

    // Delete from disk
    await deleteFromDisk('emails.json')

    console.log(`${timestamp()} Emails deleted from Firestore and disk`)
  } catch (error) {
    console.warn(`${timestamp()} Error deleting emails:`, error)
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
  const refresh = url.searchParams.get('refresh')
  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')
  const fingerprint = url.searchParams.get('fingerprint')

  console.log(
    `${timestamp()} GET /api/emails request params: refresh=${refresh}, startDate=${startDate}, endDate=${endDate}, fingerprint=${fingerprint}`,
  )

  let storedEmails = await loadEmails()
  console.log(`${timestamp()} Loaded ${storedEmails.length} stored emails`)

  let emailCache = storedEmails.reduce((acc, email) => {
    if (email.fingerprint) {
      acc[email.fingerprint] = email
    }
    return acc
  }, {})
  console.log(`${timestamp()} Created email cache with ${Object.keys(emailCache).length} entries`)

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      let responseComplete = false

      function sendData(data, status = 'stream') {
        // console.log(`${timestamp()} Sending data with status: ${status}`)
        controller.enqueue(
          encoder.encode(
            `data: { "chunk": ${JSON.stringify(data)}, "status": ${JSON.stringify(status)} }\n\n`,
          ),
        )

        if (responseComplete) {
          console.log(`${timestamp()} Response complete, sending complete message`)
          controller.enqueue(encoder.encode(`data: { "status": "complete" }\n\n`))
        }
      }

      async function streamResponse(chunk) {
        const prompts = await getPrompts()

        if (!prompts.system || !prompts.user) {
          throw new Error('Required prompts not found')
        }

        const systemContent = expand(prompts.system.current || prompts.system.default, prompts)
        const userContent = prompts.user + JSON.stringify(chunk)

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
        }

        let emailsJson = ''
        let emailsToSave = []

        for await (const data of stream) {
          const chunk = data.choices[0].delta.content
          const status = data.choices[0].finish_reason
          if (!status) {
            // Streaming response
            emailsJson += chunk
            sendData(chunk)
          } else if (status === 'stop') {
            // Full response end of this streaming chunk
            const emails = parse(emailsJson.trim()).emails || []
            emailsToSave = [...emailsToSave, ...emails]
            // console.log(`${timestamp()} // sendData(emails, 'stop')`)
            sendData('', 'stop')
          } else {
            sendData('', status)
          }
        }
        return emailsToSave
      }

      try {
        console.log(
          `${timestamp()} Processing request: refresh=${refresh}, fingerprint=${fingerprint}, stored emails: ${storedEmails.length}`,
        )

        if (fingerprint) {
          // Handle single note refresh
          const response = await fetch(
            `http://localhost:${port}/api/notes?fingerprint=${fingerprint}`,
          )
          const note = await response.json()

          if (note.length === 0) {
            throw new Error(`Note not found for fingerprint: ${fingerprint}`)
          }

          let email = emailCache[fingerprint]

          if (!email || refresh === 'all' || refresh === fingerprint) {
            const [generatedEmail] = await streamResponse([note[0]])
            if (generatedEmail) {
              email = generatedEmail
              // Update stored emails and cache
              storedEmails = storedEmails.filter((e) => e.fingerprint !== fingerprint)
              storedEmails.push(email)
              emailCache[fingerprint] = email
              await saveEmails(storedEmails)
            }
          }

          if (email) {
            sendData({ emails: [email] }, 'stop')
          } else {
            throw new Error(`Failed to generate or retrieve email for fingerprint: ${fingerprint}`)
          }
        } else {
          // Handle multiple notes (existing bulk processing logic)
          let notesToProcess = []
          const response = await fetch(
            `http://localhost:${port}/api/notes?startDate=${startDate}&endDate=${endDate}`,
          )
          notesToProcess = await response.json()

          console.log(`${timestamp()} Fetched ${notesToProcess.length} notes to process`)

          const noteChunks = chunkArray(notesToProcess, isProduction ? 8 : 2)
          console.log(`${timestamp()} Created ${noteChunks.length} note chunks`)

          let emailsToSave = []
          let emailsToSend = []

          for (const chunk of noteChunks) {
            const chunkToProcess = chunk.filter(
              (note) =>
                refresh === 'all' || !emailCache[note.fingerprint] || refresh === note.fingerprint,
            )

            if (chunkToProcess.length > 0) {
              const emailChunk = await streamResponse(chunkToProcess)
              emailsToSave = [...emailsToSave, ...emailChunk]
              console.log(`${timestamp()} Generated ${emailsToSave.length} new emails`)
            }

            chunk.forEach((note) => {
              const email =
                emailCache[note.fingerprint] ||
                emailsToSave.find((e) => e.fingerprint === note.fingerprint)
              if (email) {
                emailsToSend.push(email)
              }
            })
          }

          // Send all prepared emails at once
          sendData({ emails: emailsToSend }, 'stop')

          if (emailsToSave.length > 0) {
            // Merge new emails with existing ones, replacing any with the same fingerprint
            const updatedEmails = [
              ...storedEmails.filter(
                (email) =>
                  !emailsToSave.some((newEmail) => newEmail.fingerprint === email.fingerprint),
              ),
              ...emailsToSave,
            ]
            console.log(`${timestamp()} Merged emails, total count: ${updatedEmails.length}`)
            await saveEmails(updatedEmails)
          }
        }

        responseComplete = true
        sendData('', 'stop')

        console.log(`${timestamp()} Closing controller`)
        controller.close()
      } catch (error) {
        console.error(`${timestamp()} Error processing emails:`, error)
        sendData({ error: error.message || 'Internal server error' }, 'error')
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

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
  // console.log(`${timestamp()} Loading emails from disk`)
  try {
    const diskEmails = await readFromDisk('emails.json')
    if (diskEmails) {
      return diskEmails
    }

    console.log(
      `${timestamp()} Emails not on disk, loading from Firestore, saving to disk, returning`,
    )
    const emailsCollection = collection(firestore, 'emails')
    const snapshot = await getDocs(emailsCollection)
    const emails = snapshot.docs.map((doc) => doc.data())
    await writeToDisk('emails.json', emails)
    return emails
  } catch (error) {
    console.warn(`${timestamp()} Error loading emails:`, error)
    return [] // Return empty array, client-side will use local storage
  }
}

async function saveEmails(emails) {
  console.warn(`${timestamp()} Saving emails to disk and Firestore`)

  // Log the total number of emails
  console.log(`${timestamp()} Total emails: ${emails.length}`)

  // Save to disk
  try {
    await writeToDisk('emails.json', emails)
    console.log(`${timestamp()} Saved ${emails.length} emails to disk`)
  } catch (error) {
    console.warn(`${timestamp()} Error saving emails to disk:`, error)
  }

  // Save to Firestore
  if (!firestore) {
    console.warn('${timestamp()} Firestore is not initialized')
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
        console.warn(`${timestamp()} Email without fingerprint at index ${index}:`, email)
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

  let storedEmails = []
  let emailCache = {}

  if (refresh === 'all') {
    await deletePreviousEmails()
  } else {
    storedEmails = await loadEmails()
    emailCache = storedEmails.reduce((acc, email) => {
      if (email.fingerprint) {
        acc[email.fingerprint] = email
      }
      return acc
    }, {})
  }

  // Filter stored emails based on date range
  const filteredEmails = storedEmails.filter((email) => {
    const emailDate = new Date(email.date)
    return emailDate >= new Date(startDate) && emailDate < new Date(endDate)
  })

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      let responseComplete = false

      function sendData(data, status = 'stream') {
        // console.log(JSON.stringify(data), status)
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
          `${timestamp()} GET /api/emails${refresh ? `?refresh=${refresh}` : ''}, stored emails: ${storedEmails?.length || 0}, filtered emails: ${filteredEmails?.length || 0}`,
        )

        if (refresh === 'all' || filteredEmails.length === 0) {
          console.log(`${timestamp()} Refreshing emails for date range ${startDate}-${endDate}`)

          const noteChunks = await fetch(
            `http://localhost:${port}/api/notes?startDate=${startDate}&endDate=${endDate}`,
          )
            .then((res) => res.json())
            .then((sortedNotes) => chunkArray(sortedNotes, isProduction ? 8 : 2))

          let emailsToSave = []
          for (const chunk of noteChunks) {
            const emailChunk = await streamResponse(chunk)
            emailsToSave = [...emailsToSave, ...emailChunk]
          }
          responseComplete = true
          sendData('', 'stop')

          console.log(`${timestamp()} Closing controller`)
          controller.close()

          // Merge new emails with existing ones, replacing any with the same fingerprint
          const updatedEmails = [
            ...storedEmails.filter(
              (email) =>
                !emailsToSave.some((newEmail) => newEmail.fingerprint === email.fingerprint),
            ),
            ...emailsToSave,
          ]
          await saveEmails(updatedEmails)
          // sendData({ emails: emailsToSave }, 'stop')
        } else if (refresh?.length === 40) {
          console.log(`${timestamp()} Refreshing single email`)

          const noteToRefresh = await fetch(`http://localhost:${port}/api/notes`)
            .then((res) => res.json())
            .then((notes) => notes.find((n) => n.fingerprint === refresh))

          if (noteToRefresh) {
            const singleEmail = await streamResponse([noteToRefresh])
            emailCache[refresh] = singleEmail[0]
            // Sent just the one in procesChunk, so save + send them all here
            const updatedEmails = storedEmails.map((email) =>
              email.fingerprint === refresh ? singleEmail[0] : email,
            )
            await saveEmails(updatedEmails)
            responseComplete = true
            sendData({ emails: updatedEmails }, 'stop')
            console.log(`${timestamp()} Closing controller`)
            controller.close()
          } else {
            sendData({ error: 'Note not found' }, 'error')
          }
        } else if (filteredEmails?.length > 0) {
          responseComplete = true
          // Full resonses get 'stop' with them
          sendData({ emails: filteredEmails }, 'stop')
          console.log(
            `${timestamp()} Closing controller, sent ${filteredEmails.length} filtered emails`,
          )
          controller.close()
        }
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

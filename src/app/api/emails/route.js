// src/app/api/emails/route.js

import dotenv from 'dotenv'
import OpenAI from 'openai'
import { parse } from 'best-effort-json-parser'
import prompts from './prompts.js'
import { firestore } from '../../../firebase.js'
import { readFromDisk, writeToDisk, deleteFromDisk } from '../../utils/diskStorage'
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore'
import { chunkArray } from '../../utils/arrayUtils'
import { timestamp } from '../../utils/timestamp'

dotenv.config()
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

  // Log the total number of emails and any empty ones
  console.log(`${timestamp()} Total emails: ${emails.length}`)
  const emptyEmails = emails.filter((email) => Object.keys(email).length === 0)
  console.log(`${timestamp()} Number of empty emails: ${emptyEmails.length}`)

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
    emails.forEach((email, index) => {
      if (Object.keys(email).length === 0) {
        console.warn(`${timestamp()} Empty email object at index ${index}`)
        return
      }
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

export async function GET(req) {
  const url = new URL(req.url)
  const refresh = url.searchParams.get('refresh')

  let storedEmails = []

  if (refresh === 'all') {
    await deletePreviousEmails()
  } else {
    storedEmails = await loadEmails()
  }

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
        const userPrompt = prompts.base + JSON.stringify(chunk)
        const messages = [
          { role: 'system', content: prompts.system },
          { role: 'user', content: userPrompt },
        ]

        let stream
        try {
          stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            stream: true,
            response_format: { type: 'json_object' },
            messages,
            seed: 0,
          })
        } catch (error) {
          console.warn(`${timestamp()} API error:`, String(error))
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
          `${timestamp()} GET /api/emails${refresh ? `?refresh=${refresh}` : ''}, stored emails: ${storedEmails?.length || 0}`,
        )

        if (refresh === 'all' || !(storedEmails?.length > 0)) {
          console.log(`${timestamp()} Refreshing all emails`)

          const noteChunks = await fetch(`http://localhost:${port}/api/notes`)
            .then((res) => res.json())
            // .then((notes) =>
            //   notes
            //     .filter((note) => note.code === '911 EMER')
            //     .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time))
            //     .slice(0, 5),
            // )
            .then((sortedNotes) => chunkArray(sortedNotes, 1))

          let emailsToSave = []
          for (const chunk of noteChunks) {
            const emailChunk = await streamResponse(chunk)
            emailsToSave = [...emailsToSave, ...emailChunk]
          }
          responseComplete = true
          sendData('', 'stop')

          console.log(`${timestamp()} Closing controller`)
          controller.close()

          // Needed to get more than 8 emails:
          await saveEmails(emailsToSave)
        } else if (refresh?.length === 40) {
          console.log(`${timestamp()} Refreshing single email`)

          const noteToRefresh = await fetch(`http://localhost:${port}/api/notes`)
            .then((res) => res.json())
            .then((notes) => notes.find((n) => n.fingerprint === refresh))

          if (noteToRefresh) {
            const singleEmail = await streamResponse([noteToRefresh])
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
        } else if (storedEmails?.length > 0) {
          responseComplete = true
          // Full resonses get 'stop' with them
          sendData({ emails: storedEmails }, 'stop')
          console.log(`${timestamp()} Closing controller`)
          controller.close()
        }
      } catch (error) {
        console.error('${timestamp()} Error processing emails:', error.split('\n')[0])
        sendData({ error: 'Internal server error' }, 'error')
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

// src/app/api/emails/route.js

import dotenv from 'dotenv'
import OpenAI from 'openai'
import { parse } from 'best-effort-json-parser'
import prompts from './prompts.js'
import { firestore } from '../../../firebase.js'
import { readFromDisk, writeToDisk, deleteFromDisk } from '../../utils/diskStorage'
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore'
import { chunkArray } from '../../utils/arrayUtils'

dotenv.config()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const port = process.env.PORT

async function loadEmails() {
  // console.log(`Loading emails from disk`)
  try {
    const diskEmails = await readFromDisk('emails.json')
    if (diskEmails) {
      return diskEmails
    }

    console.log(`Emails not found on disk, loading from Firestore, saving to disk and returning`)
    const emailsCollection = collection(firestore, 'emails')
    const snapshot = await getDocs(emailsCollection)
    const emails = snapshot.docs.map((doc) => doc.data())
    await writeToDisk('emails.json', emails)
    return emails
  } catch (error) {
    console.error(`Error loading emails:`, error)
    return [] // Return empty array, client-side will use local storage
  }
}

async function saveEmails(emails) {
  console.log(`Saving emails to Firestore`)

  try {
    await writeToDisk('emails.json', emails)
    console.log(`Saved ${emails.length} emails to disk`)
  } catch (error) {
    console.error(`Error saving emails to disk:`, error)
  }

  if (!firestore) {
    console.error('Firestore is not initialized')
    return
  }

  const batch = writeBatch(firestore)
  try {
    emails.forEach((email, index) => {
      const docRef = doc(firestore, 'emails', email.fingerprint)
      batch.set(docRef, email)
    })
    await batch.commit()
    console.log(`Saved ${emails.length} emails to Firestore`)
  } catch (error) {
    console.error(`Error saving emails to Firestore:`, error)
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

    console.log('Emails deleted from Firestore and disk')
  } catch (error) {
    console.error(`Error deleting emails:`, error)
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
    console.log(`Stored emails:`, storedEmails.length)
  }

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      function sendData(data, status = 'stream') {
        console.log(data)
        if (data.hasOwnProperty('emails')) {
          console.log(`Sending full response`)
        } else {
          // Streaming response
        }

        console.log(`Sending { chunk: { emails (${data.emails.length}) }, status: "${status}"`)
        controller.enqueue(
          encoder.encode(
            `data: { "chunk": ${JSON.stringify(data)}, "status": ${JSON.stringify(status)} }\n\n`,
          ),
        )
      }

      async function streamChunkResponse(chunk) {
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
          console.warn(`API error:`, String(error))
        }

        let emailsJson = ''
        let emailsToSave = []

        for await (const data of stream) {
          const chunk = data.choices[0].delta.content
          const status = data.choices[0].finish_reason

          if (chunk.length === 0) {
            console.log(`WARNING: API Error:`)
            console.dir(data, { depth: null })
          }

          if (!status) {
            // Legit streaming response
            emailsJson += chunk
            console.log(`// sendData(chunk, 'stream')`)
            sendData(chunk)
          } else if (status === 'stop') {
            const emails = parse(emailsJson.trim()).emails || []
            emailsToSave = [...emailsToSave, ...emails]
            console.log(`// sendData(emails, 'stop')`)
            sendData('', 'stop')
          } else {
            sendData(status, status)
          }
        }
        return emailsToSave
      }

      try {
        console.log(
          `Processing request. ${refresh ? `?refresh=${refresh}, ` : ''}Stored emails: ${storedEmails?.length || 0}`,
        )

        if (refresh === 'all' || !(storedEmails?.length > 0)) {
          const noteChunks = await fetch(`http://localhost:${port}/api/notes`)
            .then((res) => res.json())
            .then((notes) =>
              notes
                .filter((note) => note.code === '911 EMER')
                .sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time)),
            )
            .then((sortedNotes) => chunkArray(sortedNotes, 8))

          let emailsToSave = []
          for (const chunk of noteChunks) {
            const emailChunk = await streamChunkResponse(chunk)
            emailsToSave = [...emailsToSave, ...emailChunk]
            for (const email of emailChunk) {
              emailsToSave = [...emailsToSave, email]
            }
            // Not needed since we already streamed each email in the chunk:
            sendData({ emails: emailChunk }, 'stream')
          }
          // Needed to get more than 8 emails:
          await saveEmails(emailsToSave)
        } else if (refresh?.length === 40) {
          // Refresh single email
          const noteToRefresh = await fetch(`http://localhost:${port}/api/notes`)
            .then((res) => res.json())
            .then((notes) => notes.find((n) => n.fingerprint === refresh))

          console.log(`Note to refresh: `, noteToRefresh.company)
          if (noteToRefresh) {
            const singleEmail = await streamChunkResponse([noteToRefresh])
            console.log(`singleEmail: `, singleEmail)

            // Sent just the one in procesChunk, so save + send them all here
            const updatedEmails = storedEmails.map((email) =>
              email.fingerprint === refresh ? singleEmail[0] : email,
            )
            console.log(
              `send updatedEmails, stop. storedEmails: ${storedEmails.length}, updatedEmails: ${storedEmails.length}`,
            )
            await saveEmails(updatedEmails)
            sendData({ emails: updatedEmails }, 'stop')
          } else {
            sendData({ error: 'Note not found' }, 'error')
          }
        } else if (storedEmails?.length > 0) {
          console.log(`Sending ${storedEmails.length} stored emails`)
          sendData({ emails: storedEmails })
        }
      } catch (error) {
        console.error('Error processing emails:', error.split('\n')[0])
        sendData({ error: 'Internal server error' }, 'error')
      } finally {
        console.log('Closing controller')
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

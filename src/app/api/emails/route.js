// src/app/api/emails/route.js

import dotenv from 'dotenv'
import OpenAI from 'openai'
import { parse } from 'best-effort-json-parser'
import prompts from './prompts.js'
import { firestore } from '../../../firebase.js'
import { readFromDisk, writeToDisk, deleteFromDisk } from '../../utils/diskStorage'
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore'

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
  let logStr = ''

  // This filtering may not be needed; if the object returns, it'll have a fingerprint
  const validEmails = emails.filter(
    (email) =>
      email &&
      typeof email === 'object' &&
      email.fingerprint &&
      typeof email.fingerprint === 'string',
  )

  try {
    await writeToDisk('emails.json', validEmails)
    logStr += `Saved ${validEmails.length} valid emails to disk`
  } catch (error) {
    console.error(`Error saving emails to disk:`, error)
  }

  if (!firestore) {
    console.error('Firestore is not initialized')
    return
  }

  const batch = writeBatch(firestore)
  try {
    validEmails.forEach((email) => {
      const docRef = doc(firestore, 'emails', email.fingerprint)
      batch.set(docRef, email)
    })

    await batch.commit()
    logStr += ` and Firestore`
    console.log(logStr)
  } catch (error) {
    console.error(`Error saving emails to Firestore:`, error)
    console.error(`Error details:`, error.stack)
  }

  if (validEmails.length < emails.length) {
    console.warn(`Skipped ${emails.length - validEmails.length} invalid emails`)
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

  // Delete documents if refresh is forced
  if (refresh === 'all') {
    await deletePreviousEmails()
  } else {
    storedEmails = await loadEmails()
  }

  const storedEmailExist = storedEmails.length > 0

  const encoder = new TextEncoder()
  const readableStream = new ReadableStream({
    async start(controller) {
      function sendData(data, status = 'stream') {
        controller.enqueue(
          encoder.encode(
            `data: { "chunk": ${JSON.stringify(data)}, "status": ${JSON.stringify(status)} }\n\n`,
          ),
        )
      }

      async function processChunk(chunk) {
        const userPrompt = prompts.base + JSON.stringify(chunk)
        const messages = [
          {
            role: 'system',
            content: prompts.system,
          },
          {
            role: 'user',
            content: userPrompt,
          },
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
          sendData(JSON.stringify([]), 'error')
          return []
        }

        let emailsJson = ''
        let chunkEmails = []

        for await (const data of stream) {
          const chunk = data.choices[0].delta.content
          const status = data.choices[0].finish_reason
          if (!status) {
            emailsJson += chunk
            // Send token/chunk
            sendData(chunk, 'stream')
          } else if (status === 'stop') {
            const emails = parse(emailsJson.trim()).emails || []
            chunkEmails = [...chunkEmails, ...emails]
            sendData(JSON.stringify(emails), 'stop') // Duplicate?
          }
        }

        return chunkEmails
      }

      if (refresh === 'all') {
        const notes = await fetch(`http://localhost:${port}/api/notes`).then((res) => res.json())
        const chunkArray = (array, chunkSize) => {
          const chunks = []
          for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize))
          }
          return chunks
        }
        const noteChunks = chunkArray(notes, 8)

        let allEmails = []
        for (const chunk of noteChunks) {
          const chunkEmails = await processChunk(chunk)
          allEmails = [...allEmails, ...chunkEmails]
          sendData(JSON.stringify({ emails: chunkEmails }), 'stream')
        }
        await saveEmails(allEmails)
        sendData('', 'stop') // Signal that all emails are processed
      } else if (refresh?.length === 40) {
        const notes = await fetch(`http://localhost:${port}/api/notes`).then((res) => res.json())
        // Process single note
        const noteToRefresh = notes.find((n) => n.fingerprint === refresh)
        if (noteToRefresh) {
          const refreshedEmail = await processChunk([noteToRefresh])
          console.log('Refreshed email:', refreshedEmail)
          const updatedEmails = storedEmails.map((email) =>
            email.fingerprint === refresh ? refreshedEmail[0] : email,
          )
          await saveEmails(updatedEmails)
          sendData(JSON.stringify({ emails: updatedEmails }), 'stream')
          sendData('', 'stop')
        } else {
          sendData(JSON.stringify({ error: 'Note not found' }), 'error')
        }
      } else if (storedEmailExist) {
        sendData(JSON.stringify({ emails: storedEmails }), 'stop')
      }

      controller.close()
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

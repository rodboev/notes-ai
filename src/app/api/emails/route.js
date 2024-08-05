// src/app/api/emails/route.js

import dotenv from 'dotenv'
import OpenAI from 'openai'
import { parse } from 'best-effort-json-parser'
import prompts from './prompts.js'
import { firestore } from '../../../firebase.js'
import { readFromDisk, writeToDisk } from '../../utils/diskStorage'
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore'

dotenv.config()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const port = process.env.PORT

let emailsToSave = []

async function loadEmails() {
  console.log(`Loading emails from disk`)
  try {
    const diskEmails = await readFromDisk('emails.json')
    if (diskEmails) {
      return diskEmails
    }

    console.log(`Emails not found on disk, loading from Firestore`)
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

export async function GET(req) {
  const url = new URL(req.url)
  const refresh = url.searchParams.get('refresh')

  let storedEmails = []

  // Delete documents if refresh is forced
  if (refresh === 'all') {
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
      await writeToDisk('emails.json', [])

      console.log('Emails deleted from Firestore and disk')
    } catch (error) {
      console.error(`Error deleting emails:`, error)
    }
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

      if (storedEmailExist) {
        sendData(JSON.stringify({ emails: storedEmails }))
      }

      if (refresh === 'all' || !storedEmailExist) {
        const notes = await fetch(`http://localhost:${port}/api/notes`).then(
          (res) => res.json(),
        )

        const chunkArray = (array, chunkSize) => {
          const chunks = []
          for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize))
          }
          return chunks
        }
        const noteChunks = chunkArray(notes, 8)

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
          }

          let emailsJson = ''

          for await (const data of stream) {
            const chunk = data.choices[0].delta.content
            const status = data.choices[0].finish_reason
            if (!status) {
              emailsJson += chunk
              sendData(chunk)
            } else if (status === 'stop') {
              const emails = parse(emailsJson.trim()).emails || []
              for (const email of emails) {
                emailsToSave = [...emailsToSave, email]
              }
              sendData('', status)
            } else {
              sendData(JSON.stringify([]), 'error')
            }
          }
          await saveEmails(emailsToSave)
        }

        for (const chunk of noteChunks) {
          await processChunk(chunk)
        }
      }

      req.signal.addEventListener('abort', () => {
        controller.close()
      })
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

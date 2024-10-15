// src/app/api/emails/route.js

import OpenAI from 'openai'
import { parse } from 'best-effort-json-parser'
import { readFromDisk, writeToDisk } from '@/utils/diskStorage'
import { timestamp } from '@/utils/timestamp'
import { getPrompts } from '@/api/prompts'
import { firestoreBatchWrite, firestoreGetAllDocs } from '@/utils/firestoreHelper'
import { GET as getNotes } from '../notes'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const isProduction = process.env.NODE_ENV === 'production'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const NOTES_PER_GROUP = isProduction ? 10 : 3

const chunkArray = (array, chunkSize) => {
  const chunks = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

// Add a simple in-memory cache
const emailCache = new Map()

const BATCH_SIZE = 32
let emailBatch = []

async function saveEmails(emails, forceSave = false) {
  // Update the cache and batch
  for (const email of emails) {
    emailCache.set(email.fingerprint, email)
    emailBatch.push(email)
  }

  // If we've reached the batch size or forceSave is true, trigger the save
  if (emailBatch.length >= BATCH_SIZE || forceSave) {
    console.warn(`${timestamp()} Saving ${emailBatch.length} emails to disk and Firestore`)

    // Save to disk
    await writeToDisk('emails.json', Array.from(emailCache.values()))
    console.log(`${timestamp()} Saved ${emailCache.size} emails to disk`)

    // Save to Firestore
    console.log(`${timestamp()} Triggering Firestore write`)
    const { validOperations, skippedOperations, error } = await firestoreBatchWrite(
      'emails',
      emailBatch,
    )

    if (error) {
      console.error('Error during batch write:', error)
    } else {
      console.log(
        `${timestamp()} Saved ${validOperations} emails to Firestore, skipped ${skippedOperations}`,
      )
    }

    // Clear the batch
    emailBatch = []
  }
}

async function loadEmails() {
  if (emailCache.size > 0) {
    console.log(`${timestamp()} Loaded ${emailCache.size} emails from cache`)
    return Array.from(emailCache.values())
  }

  const diskEmails = await readFromDisk('emails.json')
  if (diskEmails) {
    console.log(`${timestamp()} Loaded ${diskEmails.length} emails from disk`)
    for (const email of diskEmails) {
      emailCache.set(email.fingerprint, email)
    }
    return diskEmails
  }

  console.log(`${timestamp()} Emails not on disk, loading from Firestore`)
  const emails = await firestoreGetAllDocs('emails')
  console.log(`${timestamp()} Loaded ${emails.length} emails from Firestore`)
  for (const email of emails) {
    emailCache.set(email.fingerprint, email)
  }
  await writeToDisk('emails.json', emails)
  console.log(`${timestamp()} Saved ${emails.length} emails to disk`)
  return emails
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
    const notes = await getNotes({ query: searchParams })
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

export const GET = async (req, res) => {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`)
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

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  let responseComplete = false
  let dataSent = false
  const sentFingerprints = new Set()

  function sendData(data, status) {
    const payload = {
      chunk:
        status === 'stored' || status === 'streaming'
          ? typeof data === 'string'
            ? data
            : JSON.stringify(data)
          : data,
      status,
    }
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
    dataSent = true
  }

  async function streamResponse(chunk) {
    const prompts = await getPrompts()
    if (!prompts.system || !prompts.user) throw new Error('Required prompts not found')

    const systemContent = expand(prompts.system.current || prompts.system.default, prompts)
    const chunkWithoutAddress = chunk.map(({ address, ...rest }) => rest)
    const userContent = `${prompts.user}\n\n${JSON.stringify(chunkWithoutAddress)}`
    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ]

    let stream
    try {
      stream = await openai.chat.completions.create({
        model: 'gpt-4-0613',
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
        const uniqueNewEmails = emails.filter((email) => !sentFingerprints.has(email.fingerprint))
        for (const email of uniqueNewEmails) sentFingerprints.add(email.fingerprint)
        return emails
      }
    }
  }

  try {
    if (fingerprint) {
      // Handle single note refresh (always stream)
      console.log(`${timestamp()} Fetching note for fingerprint: ${fingerprint}`)
      const note = await fetchWithErrorHandling(`fingerprint=${fingerprint}`)
      if (!note || note.length === 0)
        throw new Error(`Note not found for fingerprint: ${fingerprint}`)

      // Force refresh the email
      const [generatedEmail] = await streamResponse([note[0]])
      if (!generatedEmail)
        throw new Error(`Failed to generate email for fingerprint: ${fingerprint}`)

      // Update stored emails and cache
      storedEmails = storedEmails.filter((e) => e.fingerprint !== fingerprint)
      storedEmails.push(generatedEmail)
      emailCache[fingerprint] = generatedEmail
      await saveEmails(storedEmails)
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
          for (const email of uniqueStoredEmails) sentFingerprints.add(email.fingerprint)
        }
      }

      const fingerprintsToFetch = validRequestedFingerprints.filter((fp) => !emailCache[fp])

      if (fingerprintsToFetch.length > 0) {
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
          for (const email of newEmailGroup) {
            emailCache[email.fingerprint] = email
          }
          console.log(
            `${timestamp()} Generated ${newEmailGroup.length} new emails in group ${index + 1}`,
          )
          await saveEmails(newEmailGroup)
        }

        // Force save any remaining emails
        await saveEmails([], true)
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
    // Force save any remaining emails before closing the stream
    await saveEmails([], true)
    if (!dataSent) sendData({}, 'complete')
    res.end()
  }
}

// src/app/api/prompts/route.js

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getDoc, setDoc, doc } from 'firebase/firestore'
import { firestore } from '@/firebase.js'
import promptsDefault from './prompts-default.js'

const promptsCurrent = join(process.cwd(), 'data', 'prompts-current.json')

async function loadPromptsFromDisk(path) {
  try {
    const data = await readFile(path, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`File not found: ${path}`)
      return null
    }
    console.warn(`Failed to read prompts from ${path}:`, error)
    return null
  }
}

async function loadPromptsFromFirestore() {
  try {
    const promptsDoc = await getDoc(doc(firestore, 'prompts', 'current'))
    if (promptsDoc.exists()) {
      return promptsDoc.data()
    }
  } catch (error) {
    console.warn('Failed to read prompts from Firestore:', error)
  }
  return null
}

async function savePrompts(prompts) {
  try {
    const currentPrompts = await loadPromptsFromDisk(promptsCurrent)
    const hasChanges = JSON.stringify(currentPrompts) !== JSON.stringify(prompts)

    if (hasChanges) {
      // Write to disk
      await writeFile(promptsCurrent, JSON.stringify(prompts, null, 2), 'utf8')
      console.log('Successfully wrote prompts to disk')

      // Write to Firestore
      await setDoc(doc(firestore, 'prompts', 'current'), prompts)
      console.log('Successfully wrote prompts to Firestore')
    } else {
      console.log('No changes detected, skipping save operation')
    }
  } catch (error) {
    console.warn('Failed to save prompts:', error)
  }
}

export async function getPrompts() {
  let currentPrompts = await loadPromptsFromDisk(promptsCurrent)

  if (!currentPrompts) {
    console.log('Current prompts not found on disk, fetching from Firestore')
    currentPrompts = await loadPromptsFromFirestore()
    if (currentPrompts) {
      console.log('Prompts found in Firestore, saving to disk')
      await savePrompts(currentPrompts)
    } else {
      console.log('No current prompts found in Firestore, using defaults')
      currentPrompts = {
        email: { current: promptsDefault.email.default },
        system: { current: promptsDefault.system.default },
      }
      console.log('Saving default prompts as current')
      await savePrompts(currentPrompts)
    }
  } else {
    console.log('Current prompts loaded from disk')
  }

  const mergedPrompts = {
    email: {
      object: promptsDefault.email?.object || '',
      default: promptsDefault.email?.default || '',
      current: currentPrompts.email?.current || promptsDefault.email?.default || '',
    },
    system: {
      default: promptsDefault.system?.default || '',
      current: currentPrompts.system?.current || promptsDefault.system?.default || '',
    },
    user: promptsDefault.user || '',
    error: promptsDefault.error || '',
  }

  return mergedPrompts
}

export default {
  async GET() {
    const prompts = await getPrompts()
    return new Response(JSON.stringify(prompts), {
      headers: { 'Content-Type': 'application/json' },
    })
  },

  async PATCH(req) {
    const updatedPrompts = await req.json()
    console.log('Updated prompts:', updatedPrompts)
    const toSave = {
      email: { current: updatedPrompts.email.current },
      system: { current: updatedPrompts.system.current },
    }
    await savePrompts(toSave)
    const newPrompts = await getPrompts()
    return new Response(JSON.stringify(newPrompts), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

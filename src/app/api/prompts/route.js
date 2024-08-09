// src/app/api/prompts/route.js

import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { getDoc, setDoc, doc } from 'firebase/firestore'
import { firestore } from '../../../firebase.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const promptsCurrent = join(process.cwd(), 'data', 'prompts-current.json')
const promptsDefault = join(__dirname, 'prompts-default.json')

async function loadPromptsFromDisk(path) {
  try {
    const data = await readFile(path, 'utf8')
    return JSON.parse(data)
  } catch (error) {
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
    // Write to disk
    await writeFile(promptsCurrent, JSON.stringify(prompts, null, 2), 'utf8')
    console.log('Successfully wrote prompts to disk')

    // Write to Firestore
    await setDoc(doc(firestore, 'prompts', 'current'), prompts)
    console.log('Successfully wrote prompts to Firestore')
  } catch (error) {
    console.warn('Failed to save prompts:', error)
  }
}

export async function getPrompts() {
  const defaultPrompts = await loadPromptsFromDisk(promptsDefault)
  let currentPrompts = await loadPromptsFromDisk(promptsCurrent)

  if (!defaultPrompts) {
    console.error(`Default prompts not found at ${promptsDefault}`)
    return { error: 'Default prompts not found' }
  }

  if (!currentPrompts) {
    currentPrompts = await loadPromptsFromFirestore()
    if (currentPrompts) {
      await savePrompts(currentPrompts)
    } else {
      currentPrompts = {}
    }
  }

  const mergedPrompts = {
    email: {
      object: defaultPrompts.email?.object || '',
      default: defaultPrompts.email?.default || '',
      current: currentPrompts.email?.current || defaultPrompts.email?.default || '',
    },
    system: {
      default: defaultPrompts.system?.default || '',
      current: currentPrompts.system?.current || defaultPrompts.system?.default || '',
    },
    user: defaultPrompts.user || '',
    error: defaultPrompts.error || '',
  }

  return mergedPrompts
}

export async function GET() {
  const prompts = await getPrompts()
  return NextResponse.json(prompts)
}

export async function PATCH(request) {
  const updatedPrompts = await request.json()
  const toSave = {
    email: { current: updatedPrompts.email.current },
    system: { current: updatedPrompts.system.current },
  }
  await savePrompts(toSave)
  const newPrompts = await getPrompts()
  return NextResponse.json(newPrompts)
}

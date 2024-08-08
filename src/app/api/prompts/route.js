import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { firestore } from '../../../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const promptsPath = join(process.cwd(), 'data', 'prompts.json')

async function loadPromptsFromDisk() {
  try {
    const data = await readFile(promptsPath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.warn('Failed to read prompts from disk:', error)
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

async function savePromptsToDisk(prompts) {
  try {
    await writeFile(promptsPath, JSON.stringify(prompts, null, 2))
  } catch (error) {
    console.error('Failed to save prompts to disk:', error)
  }
}

async function savePromptsToFirestore(prompts) {
  try {
    await setDoc(doc(firestore, 'prompts', 'current'), prompts)
  } catch (error) {
    console.error('Failed to save prompts to Firestore:', error)
  }
}

export async function GET() {
  let prompts = await loadPromptsFromDisk()
  if (!prompts) {
    prompts = await loadPromptsFromFirestore()
  }

  if (!prompts) {
    return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 })
  }

  return NextResponse.json({
    system: prompts.system.current,
    email: prompts.email.current,
  })
}

// export async function PUT(req) {
//   const newPrompts = await req.json()

//   await savePromptsToDisk(newPrompts)
//   await savePromptsToFirestore(newPrompts)

//   return NextResponse.json({ message: 'Prompts updated successfully' })
// }

export async function PATCH(req) {
  try {
    const updates = await req.json()
    let prompts = await loadPromptsFromDisk()

    if (!prompts) {
      prompts = await loadPromptsFromFirestore()
    }

    if (!prompts) {
      return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 })
    }

    // Update only the specified fields
    if (updates.system) {
      prompts.system.current = updates.system
    }
    if (updates.email) {
      prompts.email.current = updates.email
    }

    // Save the updated prompts
    await savePromptsToDisk(prompts)
    await savePromptsToFirestore(prompts)

    return NextResponse.json({ message: 'Prompts updated successfully' })
  } catch (error) {
    console.error('Error updating prompts:', error)
    return NextResponse.json({ error: 'Failed to update prompts' }, { status: 500 })
  }
}

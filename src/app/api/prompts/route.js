import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { firestore } from '../../../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const promptsPath = join(process.cwd(), 'data', 'prompts.json')

async function loadPromptsFromDisk() {
  try {
    const data = await readFile(promptsPath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn('Prompts file not found on disk')
    } else {
      console.warn('Failed to read prompts from disk:', error)
    }
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
    console.log('Saved prompts to disk')
  } catch (error) {
    console.error('Failed to save prompts to disk:', error)
  }
}

async function savePromptsToFirestore(prompts) {
  try {
    await setDoc(doc(firestore, 'prompts', 'current'), prompts)
    console.log('Saved prompts to Firestore')
  } catch (error) {
    console.error('Failed to save prompts to Firestore:', error)
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const all = searchParams.has('all')
  console.log(searchParams)

  let prompts = await loadPromptsFromDisk()

  if (!prompts) {
    prompts = await loadPromptsFromFirestore()

    if (prompts) {
      await savePromptsToDisk(prompts)
      console.log('Created prompts file from Firestore data')
      prompts = await loadPromptsFromDisk()
    } else {
      return NextResponse.json(
        { error: 'Failed to load prompts from disk and Firestore' },
        { status: 500 },
      )
    }
  }

  if (all) {
    return NextResponse.json(prompts)
  } else {
    return NextResponse.json({
      system: prompts.system?.current,
      email: prompts.email?.current,
    })
  }
}

export async function PATCH(req) {
  try {
    const updates = await req.json()
    let prompts = await loadPromptsFromDisk()

    if (!prompts) {
      prompts = await loadPromptsFromFirestore()
      if (prompts) {
        await savePromptsToDisk(prompts)
        prompts = await loadPromptsFromDisk()
      } else {
        return NextResponse.json(
          { error: 'Failed to load prompts from disk and Firestore' },
          { status: 500 },
        )
      }
    }

    if (updates.system) {
      prompts.system = prompts.system || {}
      prompts.system.current = updates.system
    }
    if (updates.email) {
      prompts.email = prompts.email || {}
      prompts.email.current = updates.email
    }

    await savePromptsToDisk(prompts)
    await savePromptsToFirestore(prompts)

    return NextResponse.json({ message: 'Prompts updated successfully' })
  } catch (error) {
    console.error('Error updating prompts:', error)
    return NextResponse.json({ error: 'Failed to update prompts' }, { status: 500 })
  }
}

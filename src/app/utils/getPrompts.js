import { readFile } from 'fs/promises'
import { join } from 'path'

const promptsPath = join(process.cwd(), 'data', 'prompts.json')

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

async function getPromptsFromFirestore() {
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

export async function getPrompts() {
  try {
    const data = await readFile(promptsPath, 'utf8')
    const prompts = JSON.parse(data)

    const systemContent = expand(prompts.system.current, prompts)

    return [
      { role: 'system', content: systemContent },
      { role: 'user', content: prompts.user },
    ]
  } catch (error) {
    console.warn('Failed to read prompts from local file:', error)

    // Attempt to log the contents of the prompts file
    try {
      const rawData = await readFile(promptsPath, 'utf8')
      const parsedPrompts = JSON.parse(rawData)
      console.log('Contents of prompts file:')
      console.dir(parsedPrompts, { depth: null })
    } catch (logError) {
      console.warn('Failed to log prompts file contents:', logError)
    }

    // If local file read fails, try to get prompts from Firebase
    const firestorePrompts = await getPromptsFromFirestore()

    if (firestorePrompts) {
      const systemContent = expand(firestorePrompts.system.current, firestorePrompts)

      return [
        { role: 'system', content: systemContent },
        { role: 'user', content: firestorePrompts.user },
      ]
    }

    // If both local file and Firestore fail, throw the original error
    throw error
  }
}

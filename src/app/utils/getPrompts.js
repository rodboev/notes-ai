import { readFile } from 'fs/promises'
import { join } from 'path'

const promptsPath = join(process.cwd(), 'data', 'prompts.json')

function expand(template, variables) {
  return template.replace(/{{([^}]+)}}/g, (match, key) => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], variables)
    if (typeof value === 'object' && value.object) {
      return expand(value.object, variables)
    }
    return typeof value === 'string' ? expand(value, variables) : (value ?? match)
  })
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
    console.warn('Failed to read prompts:', error)
    throw error
  }
}

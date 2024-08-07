import { readFile, writeFile } from 'fs/promises'
import { NextResponse } from 'next/server'

const promptsPath = './data/prompts.json'

export async function GET() {
  try {
    const data = await readFile(promptsPath, 'utf8')
    return NextResponse.json(JSON.parse(data))
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read prompts' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const body = await request.json()
    await writeFile(promptsPath, JSON.stringify(body, null, 2))
    return NextResponse.json({ message: 'Prompts updated successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update prompts' }, { status: 500 })
  }
}

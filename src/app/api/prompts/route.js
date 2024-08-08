import { readFile, writeFile } from 'fs/promises'
import { NextResponse } from 'next/server'

const promptsPath = './data/prompts.json'

export async function GET() {
  try {
    const data = await readFile(promptsPath, 'utf8')
    const prompts = JSON.parse(data)
    return NextResponse.json({
      system: prompts.system.current,
      email: prompts.email.current,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read prompts' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const body = await request.json()
    const data = await readFile(promptsPath, 'utf8')
    const prompts = JSON.parse(data)

    prompts.system.current = body.system
    prompts.email.current = body.email

    await writeFile(promptsPath, JSON.stringify(prompts, null, 2))
    return NextResponse.json({ message: 'Prompts updated successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update prompts' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const data = await readFile(promptsPath, 'utf8')
    const prompts = JSON.parse(data)

    prompts.system.current = prompts.system.default
    prompts.email.current = prompts.email.default

    await writeFile(promptsPath, JSON.stringify(prompts, null, 2))
    return NextResponse.json({
      message: 'Prompts reset to defaults',
      system: prompts.system.current,
      email: prompts.email.current,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reset prompts' }, { status: 500 })
  }
}

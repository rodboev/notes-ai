import { NextResponse } from 'next/server'
import { loadPromptsFromDisk, loadPromptsFromFirestore } from '../prompts/route'

export async function GET(request) {
  let prompts = await loadPromptsFromDisk()

  if (!prompts) {
    prompts = await loadPromptsFromFirestore()
  }

  return NextResponse.json(prompts)
}

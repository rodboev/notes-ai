import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const path = url.pathname.replace('/api/tinymce/', '').split('/')

    if (!Array.isArray(path) || path.length === 0) {
      throw new Error('Invalid path')
    }

    const filePath = join(process.cwd(), 'src', 'app', 'tinymce', ...path)
    // console.log('Requested TinyMCE file:', filePath)

    const fileContent = await readFile(filePath)
    const contentType = getContentType(filePath)

    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
      },
    })
  } catch (error) {
    console.error('Error serving TinyMCE file:', error)
    return new NextResponse('File not found', { status: 404 })
  }
}

function getContentType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase()
  const types = {
    js: 'application/javascript',
    css: 'text/css',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    svg: 'image/svg+xml',
  }
  return types[ext] || 'text/plain'
}

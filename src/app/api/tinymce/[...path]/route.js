import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(request, { params }) {
  const filePath = join(process.cwd(), 'src', 'app', 'tinymce', ...params.path)
  console.log('Requested TinyMCE file:', filePath)

  try {
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

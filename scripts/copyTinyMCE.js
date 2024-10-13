import fs from 'fs-extra'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const source = path.join(__dirname, '..', 'node_modules', 'tinymce')
const destination = path.join(__dirname, '..', 'src', 'app', 'tinymce')

async function copyTinyMCE() {
  try {
    await fs.ensureDir(destination)
    await fs.copy(source, destination, {
      filter: (src) => {
        const relativePath = path.relative(source, src)
        // Exclude unnecessary files/folders to reduce size
        return (
          !relativePath.startsWith('src') &&
          !relativePath.startsWith('modules') &&
          !relativePath.startsWith('tasks') &&
          !relativePath.endsWith('.txt') &&
          !relativePath.endsWith('.nuspec') &&
          !relativePath.endsWith('.less')
        )
      },
    })
    console.log('TinyMCE files copied successfully!')
  } catch (err) {
    console.error('Error copying TinyMCE files:', err)
  }
}

copyTinyMCE()

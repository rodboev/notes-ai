// src/app/utils/diskStorage.js

import fs from 'node:fs/promises'
import path from 'node:path'

const DATA_DIR = path.join(process.cwd(), 'data')

export async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

export async function readFromDisk(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename)
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function writeToDisk(filename, data) {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, filename)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

export async function deleteFromDisk(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename)
    await fs.unlink(filePath)
    console.log(`Successfully deleted ${filename} from disk`)
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`File ${filename} does not exist, no need to delete`)
    } else {
      console.error(`Error deleting ${filename} from disk:`, error)
      throw error
    }
  }
}

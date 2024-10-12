import { Worker } from 'node:worker_threads'
import { join } from 'node:path'

export function restartTunnel() {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(process.cwd(), 'src', 'app', 'workers', 'tunnelRestarter.js'))

    worker.on('message', (message) => {
      switch (message.type) {
        case 'output':
          console.log(`Tunnel ${message.stream}: ${message.message}`)
          break
        case 'success':
          console.log(message.message)
          resolve(message.message)
          worker.terminate()
          break
        case 'error':
          console.error(message.message)
          reject(new Error(message.message))
          worker.terminate()
          break
      }
    })

    worker.on('error', (error) => {
      console.error('Worker error:', error)
      reject(error)
    })

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`))
      }
    })

    worker.postMessage('restart')
  })
}

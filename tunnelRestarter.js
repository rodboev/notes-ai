const { exec } = require('node:child_process')
const { platform } = require('node:os')
const { parentPort } = require('node:worker_threads')

function log(message) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
  parentPort.postMessage({ type: 'log', message: `[${timestamp}] ${message}` })
}

function restartTunnel() {
  return new Promise((resolve, reject) => {
    const isWindows = platform() === 'win32'
    const command = isWindows
      ? 'ubuntu run /mnt/c/Dropbox/Projects/liberty/notes-ai/.profile.d/setup-wsl.sh'
      : 'bash -c "source /profile.d/setup.sh"'

    log(`Executing command: ${command}`)

    const childProcess = exec(command, (error, stdout, stderr) => {
      if (error) {
        const errorMessage = `Error restarting tunnel: ${error.message}\n\nOutput:\n${stdout}\n${stderr}`
        log(errorMessage)
        reject(new Error(errorMessage))
        return
      }
      log('Tunnel restart completed successfully')
      resolve('Tunnel restart completed successfully')
    })

    childProcess.on('exit', (code, signal) => {
      if (code !== 0) {
        const errorMessage = `Process exited with code ${code}`
        log(`Child process exited with error: ${errorMessage}`)
        // The actual error message and output will be handled in the exec callback
      }
    })
  })
}

parentPort.on('message', async (message) => {
  if (message === 'restart') {
    log('Received restart message')
    try {
      const result = await restartTunnel()
      log(`Restart result: ${result}`)
      parentPort.postMessage({ type: 'success', message: result })
    } catch (error) {
      log(`Restart error: ${error.message}`)
      parentPort.postMessage({ type: 'error', message: error.message })
    }
  } else {
    log(`Received unknown message: ${message}`)
  }
})

log('Tunnel restarter worker started')

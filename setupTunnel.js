const { restartTunnel } = require('./src/app/utils/tunnelManager')

console.log('Setting up SSH tunnel...')
restartTunnel()
  .then(() => {
    console.log('SSH tunnel setup completed successfully.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed to set up SSH tunnel:', error)
    process.exit(1)
  })

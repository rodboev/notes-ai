import express from 'express'
import http from 'node:http'
import { WebSocketServer } from 'ws'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createServer as createViteServer } from 'vite'
import cors from 'cors'

// Import your API route handlers
import * as emailsHandler from './src/api/emails/index.js'
import * as notesHandler from './src/api/notes/index.js'
import * as promptsHandler from './src/api/prompts/index.js'
import * as sendEmailHandler from './src/api/send-email/index.js'
import * as sendFeedbackHandler from './src/api/send-feedback/index.js'
import * as statusHandler from './src/api/status/index.js'

dotenv.config({ path: '.env.local' })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : 3001)
const isProduction = process.env.NODE_ENV === 'production'

console.log('[Express] Starting server...')
console.log(`[Express] Environment: ${process.env.NODE_ENV}`)

// Enable CORS for all routes
app.use(cors())

app.use(express.json())

// Logging middleware
app.use((req, res, next) => {
  console.log(`[Express] ${req.method} ${req.url}`)
  next()
})

// Set up your API routes
const apiRoutes = {
  emails: emailsHandler,
  notes: notesHandler,
  prompts: promptsHandler,
  'send-email': sendEmailHandler,
  'send-feedback': sendFeedbackHandler,
  status: statusHandler,
}

for (const [route, handler] of Object.entries(apiRoutes)) {
  app.use(`/api/${route}`, (req, res, next) => {
    console.log(`[Express] Handling ${req.method} request for /api/${route}`)
    const method = req.method.toLowerCase()
    if (handler[method]) {
      return handler[method](req, res, next)
    }
    return res.status(405).send('Method Not Allowed')
  })
}

// Vite integration
if (!isProduction) {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  })

  app.use(vite.middlewares)

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl

    try {
      // Always read fresh content from the index.html file
      const template = await vite.transformIndexHtml(url, '')

      res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
    } catch (e) {
      vite.ssrFixStacktrace(e)
      next(e)
    }
  })
} else {
  const distPath = path.join(__dirname, 'dist')
  console.log(`[Express] Serving static files from: ${distPath}`)
  app.use(express.static(distPath))

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'))
    }
  })
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected')

  ws.on('message', (message) => {
    console.log('[WebSocket] Received:', message)
    // Handle the WebSocket message here
  })

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected')
  })
})

server.listen(PORT, () => {
  console.log(`[Express] Server running on http://localhost:${PORT}`)
})

// Add error handling for the server
server.on('error', (error) => {
  console.error('[Express] Server error:', error)
})

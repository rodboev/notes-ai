'use client'

import { Inter } from 'next/font/google'
import './globals.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './utils/queryClient'
import { WebSocketProvider } from 'next-ws/client'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }) {
  const getWsUrl = () => {
    if (typeof window === 'undefined') return 'ws://localhost:80/api/ws'

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = window.location.port || '80'
    const wsPort = port === '80' || port === '443' ? '' : `:${port}`

    return `${protocol}//${host}${wsPort}/api/ws`
  }

  const wsUrl = getWsUrl()

  return (
    <html lang="en">
      <head>
        <title>Liberty Notes AI</title>
      </head>
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          <WebSocketProvider url={wsUrl}>{children}</WebSocketProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}

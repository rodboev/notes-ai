'use client'

import { Inter } from 'next/font/google'
import './globals.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './utils/queryClient'
import { WebSocketProvider } from 'next-ws/client'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }) {
  const wsUrl = `${
    typeof window !== 'undefined' ? (window.location.protocol === 'https:' ? 'wss:' : 'ws:') : 'ws:'
  }//${typeof window !== 'undefined' ? window.location.host : ''}/api/ws`

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

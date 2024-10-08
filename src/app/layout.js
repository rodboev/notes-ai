// src/app/layout.js

'use client'

import { Inter } from 'next/font/google'
import './globals.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './utils/queryClient'
import { WebSocketProvider } from 'next-ws/client'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Liberty Notes AI</title>
      </head>
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          <WebSocketProvider url="wss://localhost:3000/api/ws">{children}</WebSocketProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}

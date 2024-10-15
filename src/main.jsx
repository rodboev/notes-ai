import React from 'react'
import ReactDOM from 'react-dom/client'
import Home from '@/page'
import Providers from '@/components/Providers'
import '@/globals.css'

ReactDOM.createRoot(document.body).render(
  <Providers>
    <Home />
  </Providers>,
)

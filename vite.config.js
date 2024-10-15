/** @type {import('vite').UserConfig} */

import pluginReact from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

export default defineConfig(() => {
  return {
    plugins: [
      pluginReact({
        jsc: {
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          ws: true,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('[Vite] Proxy error:', err)
            })
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('[Vite] Sending Request to the Target:', req.method, req.url)
            })
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('[Vite] Received Response from the Target:', proxyRes.statusCode, req.url)
            })
          },
        },
      },
    },
    preview: {
      port: 3000,
    },
    css: {
      postcss: './postcss.config.js',
    },
    optimizeDeps: {
      exclude: ['msnodesqlv8'],
    },
    build: {
      commonjsOptions: {
        exclude: ['msnodesqlv8'],
      },
      minify: process.env.NODE_ENV === 'production',
      outDir: path.resolve(__dirname, 'dist'),
    },
    ssr: {
      noExternal: ['msnodesqlv8'],
    },
    root: path.resolve(__dirname, 'src'), // Set the root to the src directory
    publicDir: path.resolve(__dirname, 'public'), // Explicitly set the public directory
    clearScreen: false,
    logLevel: 'info',
    customLogger: {
      info: (msg) => console.log(`[Vite] ${msg}`),
      warn: (msg) => console.warn(`[Vite] ${msg}`),
      error: (msg) => console.error(`[Vite] ${msg}`),
      warnOnce: (msg) => console.warn(`[Vite] ${msg}`),
    },
  }
})

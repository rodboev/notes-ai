/** @type {import('vite').UserConfig} */

import pluginReact from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import path from 'node:path'
import dotenv from 'dotenv'
import fs from 'node:fs'

dotenv.config({ path: '.env.local' })

export default defineConfig(() => {
  const keyPath = './localhost+2-key.pem'
  const certPath = './localhost+2.pem'
  const httpsOptions =
    fs.existsSync(keyPath) && fs.existsSync(certPath)
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : false

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
      https: httpsOptions,
      proxy: {
        '/api': {
          target: 'https://localhost:3001',
          changeOrigin: true,
          secure: false, // Add this line to allow self-signed certificates
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
      outDir: path.resolve(__dirname, 'src', 'dist'),
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            datepicker: ['react-tailwindcss-datepicker'],
            'data-management': ['@tanstack/react-query', 'axios', '@openai/realtime-api-beta'],
            // Add more chunks as needed based on your analysis
          },
        },
      },
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

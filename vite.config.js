/** @type {import('vite').UserConfig} */

import react from '@vitejs/plugin-react-swc'
import swc from 'unplugin-swc'
import { pluginAPIRoutes as apiRoutes } from 'vite-plugin-api-routes'
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      swc.vite({
        jsc: {
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
      }),
      apiRoutes(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@public': '',
      },
    },
    server: {
      port: 3000,
      hmr: {
        port: 24678, // Default HMR port
      },
    },
    css: {
      postcss: './postcss.config.js',
    },
    optimizeDeps: {
      exclude: ['msnodesqlv8'],
      include: ['vite-plugin-api-routes'],
    },
    build: {
      commonjsOptions: {
        exclude: ['msnodesqlv8'],
      },
      minify: process.env.NODE_ENV === 'production',
      outDir: 'dist',
    },
    ssr: {
      noExternal: ['msnodesqlv8'],
    },
    root: 'src',
    // publicDir: path.resolve(__dirname, 'public'), // Explicitly set the public directory
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

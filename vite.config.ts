import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    alias: {
      // mammoth ships a Node build that only accepts { path } or { buffer }, and a
      // browser build that accepts { arrayBuffer }. Tests run the browser build so
      // they exercise the same code path the app uses.
      mammoth: 'mammoth/mammoth.browser.js',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['src/test/**', '**/*.config.*', 'src/main.tsx'],
    },
  },
})

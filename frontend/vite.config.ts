import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Em dev, a API roda em localhost:3001 — mesmo origin via proxy.
      '/api': 'http://localhost:3001',
    },
  },
})

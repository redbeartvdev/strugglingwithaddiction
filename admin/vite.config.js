import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/uploads': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
      '/images': { target: 'http://127.0.0.1:5173', changeOrigin: true },
    },
  },
})

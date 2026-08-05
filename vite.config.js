import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_PROXY || 'http://127.0.0.1:8317'

const apiProxy = {
  '/api': { target: apiTarget, changeOrigin: true },
  '/uploads': { target: apiTarget, changeOrigin: true },
  '/health': { target: apiTarget, changeOrigin: true },
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5317,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    port: 4317,
    strictPort: false,
    proxy: apiProxy,
  },
})

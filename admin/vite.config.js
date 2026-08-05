import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_PROXY || 'http://127.0.0.1:8317'
const publicTarget = process.env.VITE_PUBLIC_PROXY || 'http://127.0.0.1:5317'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/admin/' : '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/uploads': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
      '/images': { target: publicTarget, changeOrigin: true },
    },
  },
}))

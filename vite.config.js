import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_PROXY || 'http://127.0.0.1:8317'

const apiProxy = {
  '/api': { target: apiTarget, changeOrigin: true },
  '/uploads': { target: apiTarget, changeOrigin: true },
  '/health': { target: apiTarget, changeOrigin: true },
  '/robots.txt': { target: apiTarget, changeOrigin: true },
  '/sitemap.xml': { target: apiTarget, changeOrigin: true },
}

/** Keep the hashed CSS file off the render-blocking path; critical CSS lives in index.html. */
function asyncCss() {
  return {
    name: 'async-css',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        /<link\s+rel="stylesheet"([^>]*?)href="([^"]+\.css)"([^>]*)>/g,
        '<link rel="preload" as="style" href="$2" onload="this.onload=null;this.rel=\'stylesheet\'">'
        + '<noscript><link rel="stylesheet" href="$2"></noscript>',
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), asyncCss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) {
            return 'react'
          }
          if (id.includes('node_modules/react-router')) {
            return 'router'
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5317,
    strictPort: true,
    allowedHosts: true,
    proxy: apiProxy,
  },
  preview: {
    port: 4317,
    strictPort: false,
    proxy: apiProxy,
  },
})

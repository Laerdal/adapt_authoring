import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  // Served by the Adapt engine at the site root (routes/new mounts the built
  // output at "/", not "/new" - see routes/new/index.js).
  base: '/',
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Dev-only: proxy API calls to the running engine so `npm run dev` works.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Framework import endpoints (no /api/ prefix — mounted at server root)
      '/importsourcecheck': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/importsource': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
})

import { defineConfig } from 'vitest/config'
import path from 'path'

// Separate from vite.config.ts (the app build) so adding a test runner can't
// affect production build behavior. Mirrors the same '@' alias so test files
// can import app modules the same way the app itself does.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/hscode/',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../hscode', emptyOutDir: true },
  test: {
    // Every test run (unit and rules) targets the emulators / demo-hscode, never production.
    env: { VITE_USE_EMULATOR: 'true' },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['src/test-setup.ts'],
          include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
        },
      },
      {
        extends: true,
        test: {
          name: 'rules',
          globals: true,
          environment: 'node',
          include: ['tests/rules/**/*.rules.test.ts'],
          fileParallelism: false,
          testTimeout: 20000,
          hookTimeout: 30000,
        },
      },
    ],
  },
})

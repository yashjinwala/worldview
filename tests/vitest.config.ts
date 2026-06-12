import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Global setup starts the Next.js dev server once; global teardown kills it
    globalSetup: ['tests/contract/setup.ts'],
    // Per-test timeout: SSE streams can take several seconds under mock
    testTimeout: 20_000,
    hookTimeout: 15_000,
    // All tests run serially in a single process — they share one DB file and one server
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true }
    },
    sequence: {
      // Sequential across files too: prevents concurrent DB resets from racing
      concurrent: false
    },
    // Suppress Prisma "Environment variables loaded" noise
    silent: false,
  },
  resolve: {
    alias: {
      // Allows schema tests to do: import { SliderSimSchema } from 'src/templates/schemas'
      src: resolve(__dirname, '../src')
    }
  }
})

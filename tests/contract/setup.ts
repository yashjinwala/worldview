/**
 * Vitest global setup — runs once before all tests.
 * Starts the Next.js dev server in LLM_MODE=mock, runs `prisma db push` on a
 * fresh SQLite file, and waits until the server is accepting requests.
 * Global teardown kills the server process.
 */

import { spawn, ChildProcess } from 'child_process'
import { resolve, join } from 'path'
import { tmpdir } from 'os'

const PROJECT_ROOT = resolve(__dirname, '../..')
const TEST_PORT = process.env.TEST_PORT ?? '3001'
const BASE_URL = `http://localhost:${TEST_PORT}`

let serverProcess: ChildProcess | null = null

async function waitForServer(url: string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) })
      // Any HTTP response (even 404) means the server is up
      if (res.status < 600) return
    } catch {
      // ECONNREFUSED or timeout — not ready yet
    }
    await new Promise(r => setTimeout(r, 400))
  }
  throw new Error(
    `Test server at ${url} did not become ready within ${timeoutMs}ms.\n` +
    'Set VERBOSE_SERVER=1 to see server output.'
  )
}

async function runPrismaDbPush(dbPath: string): Promise<void> {
  await new Promise<void>((res, rej) => {
    const p = spawn(
      'npx',
      ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
        stdio: process.env.VERBOSE_SERVER ? 'inherit' : 'pipe',
      }
    )
    p.on('close', (code) => {
      if (code === 0) res()
      else rej(new Error(`prisma db push exited with code ${code}`))
    })
    p.on('error', rej)
  })
}

export async function setup(): Promise<void> {
  const dbPath = join(tmpdir(), `worldview-test-${Date.now()}.db`)

  // Expose to test helpers via env
  process.env.TEST_DB_PATH = dbPath
  process.env.TEST_BASE_URL = BASE_URL

  // Push the Prisma schema onto the fresh SQLite file before starting the server
  await runPrismaDbPush(dbPath)

  serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      LLM_MODE: 'mock',
      DATABASE_URL: `file:${dbPath}`,
      PORT: TEST_PORT,
      NODE_ENV: 'test',
      // Suppress Next.js telemetry
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: process.env.VERBOSE_SERVER
      ? ['ignore', 'inherit', 'inherit']
      : ['ignore', 'pipe', 'pipe'],
  })

  if (!process.env.VERBOSE_SERVER) {
    // Swallow output silently unless VERBOSE_SERVER is set
    serverProcess.stdout?.resume()
    serverProcess.stderr?.resume()
  }

  serverProcess.on('error', (err) => {
    console.error('[test server] spawn error:', err)
  })

  await waitForServer(`${BASE_URL}/api/_test/reset`)
  console.log(`[test] Server ready at ${BASE_URL} (DB: ${dbPath})`)
}

export async function teardown(): Promise<void> {
  if (serverProcess) {
    serverProcess.kill('SIGTERM')
    // Give it a moment to flush
    await new Promise(r => setTimeout(r, 800))
    serverProcess = null
  }
}

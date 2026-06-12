// The mock seam (TDD §18). Under LLM_MODE=mock, every outbound LLM call is routed
// to these in-process FIFO queues instead of the Anthropic API. One queue per role,
// consumed FIFO. State lives on globalThis so the route modules and the LLM module
// share it within the single Node process.

export type LlmRole =
  | 'sharpen'
  | 'reader'
  | 'director'
  | 'tutor'
  | 'generator-map'
  | 'generator-artifact'
  | 'profiler'
  | 'safety'

export const LLM_ROLES: LlmRole[] = [
  'sharpen',
  'reader',
  'director',
  'tutor',
  'generator-map',
  'generator-artifact',
  'profiler',
  'safety',
]

interface MockState {
  queues: Record<string, unknown[]>
}

const g = globalThis as unknown as { __wvMock?: MockState }

function state(): MockState {
  if (!g.__wvMock) {
    g.__wvMock = { queues: Object.fromEntries(LLM_ROLES.map((r) => [r, []])) }
  }
  return g.__wvMock
}

export function isMockMode(): boolean {
  return process.env.LLM_MODE === 'mock'
}

export function mockEnqueue(role: string, body: unknown): void {
  const s = state()
  ;(s.queues[role] ??= []).push(body)
}

export function mockDequeue<T = unknown>(role: string): T | undefined {
  const s = state()
  return ((s.queues[role] ??= []).shift() as T | undefined) ?? undefined
}

export function mockReset(): void {
  const s = state()
  for (const role of LLM_ROLES) s.queues[role] = []
}

/** A mock response carrying { parsed: { __simulate_failure: true } } makes the
 *  call throw — used by tests to exercise Generator/Profiler failure paths. */
export function isSimulatedFailure(resp: unknown): boolean {
  if (!resp || typeof resp !== 'object') return false
  const r = resp as Record<string, unknown>
  if (r.__simulate_failure === true) return true
  const parsed = r.parsed as Record<string, unknown> | undefined
  return !!parsed && parsed.__simulate_failure === true
}

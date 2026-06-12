/**
 * Shared test helpers: HTTP wrappers, SSE parser, Prisma client, mock seam utilities.
 * All tests import from here — no test file should call fetch() directly.
 */

import { PrismaClient } from '@prisma/client'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3001'

/** Direct DB access for assertions. Points at the same file the test server uses. */
export const prisma = new PrismaClient({
  datasourceUrl: `file:${process.env.TEST_DB_PATH ?? '/tmp/worldview-test.db'}`,
})

// ---------------------------------------------------------------------------
// Types mirroring the spec (§7, §8)
// ---------------------------------------------------------------------------

export type Posture = 'understand' | 'challenge' | 'deep-dive' | 'surprise-me'

export interface ReaderOutput {
  appetite: 'leaning_in' | 'neutral' | 'restless'
  proximityToClose: number
  justClosed: boolean
  closedLoopId?: string | null
  conversationNodeId: string | null
  positionShift?: string | null
  synthesisAnswer?: string | null
  evidence: string
}

export interface DirectorToolCall {
  name: string
  input: Record<string, unknown>
}

export interface UserModelData {
  modesThatLand: Record<string, number>
  pacing: 'fast' | 'moderate' | 'deliberate'
  styleNotes: string[]
  clickPatterns: string[]
  interests: string[]
  vocabularyLevel: 'plain' | 'comfortable' | 'technical'
}

export interface ProfilerOutput {
  data: UserModelData
  resumeSummary: string
}

export interface SafetyOutput {
  flag: boolean
  category: 'fabrication' | 'advice' | 'distress' | null
  note: string | null
}

export interface UsageTokens {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
}

export type MockEnqueueBody =
  | { role: 'sharpen'; sharpened: string; usage: UsageTokens }
  | { role: 'reader'; parsed: ReaderOutput; usage: UsageTokens }
  | { role: 'director'; tools: DirectorToolCall[]; usage: UsageTokens }
  | { role: 'tutor'; text: string; usage: UsageTokens }
  | { role: 'generator-map'; parsed: { nodes: GeneratorNode[] }; usage: UsageTokens }
  | { role: 'generator-artifact'; parsed: object; usage: UsageTokens }
  | { role: 'profiler'; parsed: ProfilerOutput; usage: UsageTokens }
  | { role: 'safety'; parsed: SafetyOutput; usage: UsageTokens }

export interface GeneratorNode {
  title: string
  summary: string
  hookQuestion: string
}

export interface SSEEvent {
  type: string
  data: unknown
}

// ---------------------------------------------------------------------------
// Mock seam control
// ---------------------------------------------------------------------------

/** Enqueue a scripted response for the next call to the given role. */
export async function enqueueResponse(body: MockEnqueueBody): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/_test/enqueue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`enqueueResponse(${body.role}) → ${res.status}: ${text}`)
  }
}

/** Clear all mock queues without touching the DB. */
export async function resetMocks(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/_test/reset`, { method: 'POST' })
  if (!res.ok) throw new Error(`resetMocks → ${res.status}`)
}

/** Truncate all DB tables in FK-safe order. */
export async function resetDB(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/_test/db/reset`, { method: 'POST' })
  if (!res.ok) throw new Error(`resetDB → ${res.status}`)
}

// ---------------------------------------------------------------------------
// API wrappers
// ---------------------------------------------------------------------------

export interface OnboardResponse {
  mapId: string
  sessionId: string
  sharpenedQuestion: string
}

export async function postOnboard(body: {
  userId: string
  posture: Posture
  rawQuestion?: string
  startingPosition?: string
}): Promise<OnboardResponse> {
  const res = await fetch(`${BASE_URL}/api/onboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST /api/onboard → ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * POST /api/turn and collect all SSE events until `done`.
 * Returns the full ordered list of events.
 * Throws if `done` is not received within timeoutMs.
 */
export async function collectTurnEvents(
  sessionId: string,
  message: string,
  opts: { timeoutMs?: number } = {}
): Promise<SSEEvent[]> {
  const timeoutMs = opts.timeoutMs ?? 15_000
  const events: SSEEvent[] = []

  const res = await fetch(`${BASE_URL}/api/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST /api/turn → ${res.status}: ${text}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEventType: string | undefined
  const deadline = Date.now() + timeoutMs

  try {
    while (Date.now() < deadline) {
      const { done, value } = await Promise.race([
        reader.read(),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`SSE timeout after ${timeoutMs}ms`)), deadline - Date.now())
        ),
      ])
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEventType = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          const rawData = line.slice(5).trim()
          const type = currentEventType ?? 'message'
          let data: unknown
          try {
            data = JSON.parse(rawData)
          } catch {
            data = rawData
          }
          events.push({ type, data })
          if (type === 'done') return events
          currentEventType = undefined
        } else if (line === '') {
          currentEventType = undefined
        }
      }
    }
  } finally {
    try { reader.releaseLock() } catch { /* ignore */ }
  }

  throw new Error(
    `collectTurnEvents: 'done' event not received within ${timeoutMs}ms. ` +
    `Events so far: ${events.map(e => e.type).join(', ')}`
  )
}

export async function endSession(sessionId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/session/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
  if (!res.ok) throw new Error(`POST /api/session/end → ${res.status}`)
}

export async function getMap(mapId: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/api/map/${mapId}`)
  if (!res.ok) throw new Error(`GET /api/map/${mapId} → ${res.status}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// DB query helpers (direct Prisma — for assertions only)
// ---------------------------------------------------------------------------

export async function getRootNode(mapId: string) {
  const node = await prisma.mapNode.findFirst({ where: { mapId, parentId: null } })
  if (!node) throw new Error(`No root node found for mapId=${mapId}`)
  return node
}

export async function getOpenLoopForNode(nodeId: string) {
  return prisma.loop.findFirst({
    where: { nodeId, closedAt: null },
  })
}

export async function getLoopForNode(nodeId: string) {
  return prisma.loop.findFirst({ where: { nodeId } })
}

export async function getLatestDirectorDecision(sessionId: string) {
  return prisma.directorDecision.findFirst({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getAllDirectorDecisions(sessionId: string) {
  return prisma.directorDecision.findMany({
    where: { sessionId },
    orderBy: { turn: 'asc' },
  })
}

export async function getSessionEvents(sessionId: string, type?: string) {
  return prisma.event.findMany({
    where: type ? { sessionId, type } : { sessionId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getSession(sessionId: string) {
  return prisma.session.findUnique({ where: { id: sessionId } })
}

export async function getMap_db(mapId: string) {
  return prisma.map.findUnique({ where: { id: mapId } })
}

// ---------------------------------------------------------------------------
// Mock response factories (sensible defaults)
// ---------------------------------------------------------------------------

export const defaultUsage: UsageTokens = { input_tokens: 200, output_tokens: 100 }

/**
 * Usage that, after a single Tutor call, pushes Session.costUsd above the $2.00 ceiling.
 * Tutor = Sonnet 4.6 ($3/$15 per MTok): 200K in + 100K out = $0.60 + $1.50 = $2.10
 */
export const CEILING_USAGE: UsageTokens = { input_tokens: 200_000, output_tokens: 100_000 }

export function makeReaderOutput(overrides: Partial<ReaderOutput> = {}): ReaderOutput {
  return {
    appetite: 'leaning_in',
    proximityToClose: 0.3,
    justClosed: false,
    closedLoopId: null,
    conversationNodeId: null,
    positionShift: null,
    synthesisAnswer: null,
    evidence: 'User engaged with the material.',
    ...overrides,
  }
}

export function makeDirectorMock(
  tools: DirectorToolCall[] = [{ name: 'setTutorMode', input: { mode: 'explain' } }]
): MockEnqueueBody & { role: 'director' } {
  return { role: 'director', tools, usage: defaultUsage }
}

export function makeTutorMock(
  text = 'Here is something interesting. Want to know more? The answer might surprise you.'
): MockEnqueueBody & { role: 'tutor' } {
  return { role: 'tutor', text, usage: defaultUsage }
}

export function makeSafetyMock(): MockEnqueueBody & { role: 'safety' } {
  return {
    role: 'safety',
    parsed: { flag: false, category: null, note: null },
    usage: defaultUsage,
  }
}

export function makeProfilerMock(
  resumeSummary = 'Last session covered the basics. Brightest open loop: "What sets the interest rate?".'
): MockEnqueueBody & { role: 'profiler' } {
  return {
    role: 'profiler',
    parsed: {
      data: {
        modesThatLand: { explain: 0.5, challenge: 0, provoke: 0, socratic: 0, support: 0 },
        pacing: 'moderate',
        styleNotes: ['prefers concrete examples'],
        clickPatterns: [],
        interests: ['economics'],
        vocabularyLevel: 'comfortable',
      },
      resumeSummary,
    },
    usage: defaultUsage,
  }
}

export function makeSeedGeneratorMock(count = 4): MockEnqueueBody & { role: 'generator-map' } {
  const nodes: GeneratorNode[] = Array.from({ length: count }, (_, i) => ({
    title: `Seed node ${i + 1}`,
    summary: `Summary of seed node ${i + 1}`,
    hookQuestion: `Hook question for seed node ${i + 1}?`,
  }))
  return { role: 'generator-map', parsed: { nodes }, usage: defaultUsage }
}

/** Generate a unique userId for test isolation. */
export function makeUserId(): string {
  return `test-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ---------------------------------------------------------------------------
// Compound helpers: setup common test scenarios
// ---------------------------------------------------------------------------

/**
 * Onboard a new user and return { userId, mapId, sessionId }.
 * Enqueues the sharpen mock and seed generator mock automatically.
 */
export async function onboardUser(opts: {
  posture?: Posture
  rawQuestion?: string
  startingPosition?: string
  sharpenedQuestion?: string
} = {}): Promise<{ userId: string; mapId: string; sessionId: string }> {
  const userId = makeUserId()
  const posture = opts.posture ?? 'understand'

  if (posture !== 'surprise-me') {
    await enqueueResponse({
      role: 'sharpen',
      sharpened: opts.sharpenedQuestion ?? 'Is the US national debt actually dangerous?',
      usage: defaultUsage,
    })
  }
  // Always enqueue a seed generator response (consumed async by the seed job)
  await enqueueResponse(makeSeedGeneratorMock())

  const response = await postOnboard({
    userId,
    posture,
    rawQuestion: opts.rawQuestion ?? 'Tell me about the national debt',
    startingPosition: opts.startingPosition,
  })

  return { userId, ...response }
}

/**
 * Do a single turn-1 (cold start: no Reader).
 * Enqueues Director + Tutor + Safety mocks.
 */
export async function doTurn1(
  sessionId: string,
  message = 'Tell me about it',
  overrides: { director?: DirectorToolCall[]; tutor?: string } = {}
): Promise<SSEEvent[]> {
  await enqueueResponse(makeDirectorMock(overrides.director))
  await enqueueResponse(makeTutorMock(overrides.tutor))
  await enqueueResponse(makeSafetyMock())
  return collectTurnEvents(sessionId, message)
}

/**
 * Do a turn N (N >= 2: includes Reader).
 * Enqueues Reader + Director + Tutor + Safety mocks.
 */
export async function doTurnN(
  sessionId: string,
  message: string,
  reader: ReaderOutput,
  overrides: { director?: DirectorToolCall[]; tutor?: string } = {}
): Promise<SSEEvent[]> {
  await enqueueResponse({ role: 'reader', parsed: reader, usage: defaultUsage })
  await enqueueResponse(makeDirectorMock(overrides.director))
  await enqueueResponse(makeTutorMock(overrides.tutor))
  await enqueueResponse(makeSafetyMock())
  return collectTurnEvents(sessionId, message)
}

/** Filter SSE events by type. */
export function eventsOfType(events: SSEEvent[], type: string): SSEEvent[] {
  return events.filter(e => e.type === type)
}

/** Return the first event of a given type, or throw. */
export function firstEventOfType(events: SSEEvent[], type: string): SSEEvent {
  const ev = events.find(e => e.type === type)
  if (!ev) throw new Error(`No '${type}' event found in: ${events.map(e => e.type).join(', ')}`)
  return ev
}

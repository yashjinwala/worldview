// The single LLM-call module (TDD §18). Every outbound model call for all eight
// roles goes through here. Under LLM_MODE=mock it routes to the in-process FIFO
// queues (mockStore) and never touches the Anthropic SDK. Cost is applied after
// every response — under mock too — so the cost tests exercise real accounting.

import { prisma } from './prisma'
import { costOf, UsageTokens } from './pricing'
import { isMockMode, mockDequeue, isSimulatedFailure } from './mockStore'
import {
  ReaderOutput,
  DirectorToolCall,
  ProfilerOutput,
  SafetyOutput,
  GeneratorMapOutput,
  DEFAULT_USER_MODEL,
} from './types'
import {
  TUTOR_ANCHOR,
  DIRECTOR_SYSTEM,
  READER_SYSTEM,
  GENERATOR_MAP_SYSTEM,
  GENERATOR_MAP_SEED_SYSTEM,
  GENERATOR_ARTIFACT_SYSTEM,
  PROFILER_SYSTEM,
  SAFETY_SYSTEM,
  SHARPEN_SYSTEM,
} from './prompts'

export interface LlmCtx {
  sessionId?: string
}

export class MockQueueEmptyError extends Error {
  constructor(public role: string) {
    super(`mock queue empty for role: ${role}`)
    this.name = 'MockQueueEmptyError'
  }
}

const TUTOR_MODEL = process.env.TUTOR_MODEL ?? 'claude-sonnet-4-6'
const HAIKU_MODEL = process.env.HAIKU_MODEL ?? 'claude-haiku-4-5'

async function applyCost(ctx: LlmCtx, sonnet: boolean, usage: UsageTokens | undefined) {
  if (!ctx.sessionId || !usage) return
  const cost = costOf(usage, sonnet)
  if (cost <= 0) return
  try {
    await prisma.session.update({
      where: { id: ctx.sessionId },
      data: { costUsd: { increment: cost } },
    })
  } catch {
    /* session may already be gone (e.g. detached generator after end) — ignore */
  }
}

// ── Lazy real-mode client ──────────────────────────────────────────────────
let _client: unknown = null
async function realClient() {
  if (_client) return _client
  const mod = await import('@anthropic-ai/sdk')
  const Anthropic = mod.default
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

/** Real-mode helper: ask Haiku for strict JSON, parse, with one retry. */
async function realHaikuJSON<T>(ctx: LlmCtx, system: string, user: string): Promise<T> {
  const client = (await realClient()) as {
    messages: { create: (args: unknown) => Promise<{ content: Array<{ type: string; text?: string }>; usage: UsageTokens }> }
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: system + '\n\nRespond with ONLY a single JSON object, no prose, no code fence.',
      messages: [{ role: 'user', content: user }],
    })
    await applyCost(ctx, false, res.usage)
    const text = res.content.find((b) => b.type === 'text')?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0]) as T
      } catch {
        /* retry once */
      }
    }
  }
  throw new Error('haiku JSON parse failed after retry')
}

// ── sharpen ────────────────────────────────────────────────────────────────
export async function sharpen(ctx: LlmCtx, rawQuestion: string): Promise<string> {
  if (isMockMode()) {
    const resp = mockDequeue<{ sharpened: string; usage: UsageTokens }>('sharpen')
    if (!resp) return rawQuestion // queue-empty default: verbatim
    await applyCost(ctx, false, resp.usage)
    return resp.sharpened
  }
  const client = (await realClient()) as {
    messages: { create: (a: unknown) => Promise<{ content: Array<{ type: string; text?: string }>; usage: UsageTokens }> }
  }
  const res = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 256,
    system: SHARPEN_SYSTEM,
    messages: [{ role: 'user', content: rawQuestion }],
  })
  await applyCost(ctx, false, res.usage)
  return (res.content.find((b) => b.type === 'text')?.text ?? rawQuestion).trim()
}

// ── reader (critical: throws when mock queue empty) ─────────────────────────
export async function reader(ctx: LlmCtx, input: unknown): Promise<ReaderOutput> {
  if (isMockMode()) {
    const resp = mockDequeue<{ parsed: ReaderOutput; usage: UsageTokens }>('reader')
    if (!resp) throw new MockQueueEmptyError('reader')
    await applyCost(ctx, false, resp.usage)
    return resp.parsed
  }
  return realHaikuJSON<ReaderOutput>(ctx, READER_SYSTEM, JSON.stringify(input))
}

// ── director (critical) ─────────────────────────────────────────────────────
export async function director(
  ctx: LlmCtx,
  input: unknown
): Promise<{ tools: DirectorToolCall[]; rationale?: string }> {
  if (isMockMode()) {
    const resp = mockDequeue<{ tools: DirectorToolCall[]; usage: UsageTokens }>('director')
    if (!resp) throw new MockQueueEmptyError('director')
    await applyCost(ctx, false, resp.usage)
    return { tools: resp.tools }
  }
  // Real mode: tool-use. Defined tools mirror §6.2; tool_choice auto.
  const client = (await realClient()) as {
    messages: { create: (a: unknown) => Promise<{ content: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>; usage: UsageTokens }> }
  }
  const res = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 512,
    system: DIRECTOR_SYSTEM,
    tools: DIRECTOR_TOOLS,
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  })
  await applyCost(ctx, false, res.usage)
  const tools = res.content
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({ name: b.name as string, input: (b.input ?? {}) as Record<string, unknown> }))
  const rationale = res.content.find((b) => b.type === 'text')?.text?.trim()
  return { tools, rationale }
}

// ── tutor (critical, streaming) ─────────────────────────────────────────────
export async function tutorStream(
  ctx: LlmCtx,
  opts: { messages: Array<{ role: string; content: string }>; firstSession: boolean },
  onDelta: (text: string) => void
): Promise<{ text: string; usage: UsageTokens }> {
  if (isMockMode()) {
    const resp = mockDequeue<{ text: string; usage: UsageTokens }>('tutor')
    if (!resp) throw new MockQueueEmptyError('tutor')
    const chunks = splitThree(resp.text)
    for (const c of chunks) {
      onDelta(c)
      await sleep(5)
    }
    await applyCost(ctx, true, resp.usage)
    return { text: resp.text, usage: resp.usage }
  }
  const client = (await realClient()) as {
    messages: { stream: (a: unknown) => AsyncIterable<unknown> & { finalMessage: () => Promise<{ usage: UsageTokens }> } }
  }
  const stream = client.messages.stream({
    model: TUTOR_MODEL,
    max_tokens: 1024,
    system: [{ type: 'text', text: TUTOR_ANCHOR, cache_control: { type: 'ephemeral' } }],
    messages: opts.messages,
  })
  let text = ''
  for await (const ev of stream as AsyncIterable<{ type: string; delta?: { type: string; text?: string } }>) {
    if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
      text += ev.delta.text
      onDelta(ev.delta.text)
    }
  }
  const final = await stream.finalMessage()
  await applyCost(ctx, true, final.usage)
  return { text, usage: final.usage }
}

// ── generator-map (non-critical: empty → empty list) ────────────────────────
export async function generatorMap(
  ctx: LlmCtx,
  input: unknown,
  seed: boolean
): Promise<GeneratorMapOutput> {
  if (isMockMode()) {
    const resp = mockDequeue<{ parsed: GeneratorMapOutput; usage: UsageTokens }>('generator-map')
    if (!resp) return { nodes: [] } // queue-empty default
    if (isSimulatedFailure(resp)) {
      await applyCost(ctx, false, resp.usage)
      throw new Error('simulated generator-map failure')
    }
    await applyCost(ctx, false, resp.usage)
    return resp.parsed
  }
  const system = seed ? GENERATOR_MAP_SEED_SYSTEM : GENERATOR_MAP_SYSTEM
  return realHaikuJSON<GeneratorMapOutput>(ctx, system, JSON.stringify(input))
}

// ── generator-artifact (non-critical: empty → null) ─────────────────────────
export async function generatorArtifact(ctx: LlmCtx, input: unknown): Promise<object | null> {
  if (isMockMode()) {
    const resp = mockDequeue<{ parsed: object; usage: UsageTokens }>('generator-artifact')
    if (!resp) return null
    if (isSimulatedFailure(resp)) {
      await applyCost(ctx, false, resp.usage)
      throw new Error('simulated generator-artifact failure')
    }
    await applyCost(ctx, false, resp.usage)
    return resp.parsed
  }
  return realHaikuJSON<object>(ctx, GENERATOR_ARTIFACT_SYSTEM, JSON.stringify(input))
}

// ── profiler (non-critical: empty → minimal) ────────────────────────────────
export async function profiler(ctx: LlmCtx, input: unknown): Promise<ProfilerOutput> {
  if (isMockMode()) {
    const resp = mockDequeue<{ parsed: ProfilerOutput; usage: UsageTokens }>('profiler')
    if (!resp) {
      return { data: DEFAULT_USER_MODEL, resumeSummary: 'No summary available.' }
    }
    if (isSimulatedFailure(resp)) {
      await applyCost(ctx, false, resp.usage)
      throw new Error('simulated profiler failure')
    }
    await applyCost(ctx, false, resp.usage)
    return resp.parsed
  }
  return realHaikuJSON<ProfilerOutput>(ctx, PROFILER_SYSTEM, JSON.stringify(input))
}

// ── safety (non-critical: empty → no flag) ──────────────────────────────────
export async function safety(ctx: LlmCtx, input: unknown): Promise<SafetyOutput> {
  if (isMockMode()) {
    const resp = mockDequeue<{ parsed: SafetyOutput; usage: UsageTokens }>('safety')
    if (!resp) return { flag: false, category: null, note: null }
    await applyCost(ctx, false, resp.usage)
    return resp.parsed
  }
  return realHaikuJSON<SafetyOutput>(ctx, SAFETY_SYSTEM, JSON.stringify(input))
}

// ── helpers ─────────────────────────────────────────────────────────────────
function splitThree(text: string): string[] {
  if (!text) return ['', '', '']
  const n = text.length
  const a = Math.floor(n / 3)
  const b = Math.floor((2 * n) / 3)
  return [text.slice(0, a), text.slice(a, b), text.slice(b)]
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

const DIRECTOR_TOOLS = [
  {
    name: 'setTutorMode',
    description: 'Set the Tutor mode for this turn, with an optional one-line emphasis note.',
    input_schema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['explain', 'challenge', 'provoke', 'socratic', 'support'] },
        note: { type: 'string' },
      },
      required: ['mode'],
    },
  },
  {
    name: 'expandMap',
    description: 'Grow the map under or beside a node (async generation).',
    input_schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        direction: { type: 'string', enum: ['deepen', 'branch'] },
      },
      required: ['nodeId', 'direction'],
    },
  },
  {
    name: 'spawnArtifact',
    description: 'Fill an interactive template to deliver the click (async generation).',
    input_schema: {
      type: 'object',
      properties: {
        templateId: {
          type: 'string',
          enum: ['slider-sim', 'predict-reveal', 'before-after', 'evidence-cards', 'timeline', 'tradeoff'],
        },
        nodeId: { type: 'string' },
        loopQuestion: { type: 'string' },
      },
      required: ['templateId', 'nodeId', 'loopQuestion'],
    },
  },
  {
    name: 'raiseCaution',
    description: 'Append a caution to the Tutor directive. May only raise caution.',
    input_schema: {
      type: 'object',
      properties: { note: { type: 'string' } },
      required: ['note'],
    },
  },
]

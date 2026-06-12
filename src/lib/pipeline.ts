// The Curiosity Engine pipeline (TDD §5/§6). Onboarding, the per-turn streaming
// pipeline, session end (Profiler + rollup), and soft-close. All node/loop lifecycle
// rules live here (§6.4 single source of truth).

import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import * as llm from './llm'
import { MockQueueEmptyError } from './llm'
import { logEvent } from './events'
import { makeSse, SseWriter } from './sse'
import {
  acquireSessionLock,
  setPendingSeed,
  getPendingSeed,
  incrLoopsClosed,
  getLoopsClosed,
  nextSurpriseIndex,
} from './sessionState'
import { SURPRISE_ROTATION } from './surprise'
import { SESSION_COST_LIMIT_USD, SESSION_COST_NEAR_USD } from './pricing'
import { OFF_MAP_SCRIPT, COST_LOCK_WRAP_UP } from './prompts'
import { TEMPLATE_SCHEMAS } from '@/templates/schemas'
import { TEMPLATE_PROMPT_SPECS } from '@/templates/promptSpecs'
import { Posture, ReaderOutput, DirectorToolCall, TutorMode, V1_TEMPLATE_IDS } from './types'

const IDLE_MS = 30 * 60 * 1000
const VALID_MODES: TutorMode[] = ['explain', 'challenge', 'provoke', 'socratic', 'support']
const GENERATOR_CAP_MS = 25_000

// ── helpers ──────────────────────────────────────────────────────────────────

function isResumeMessage(content: string): boolean {
  return content.startsWith('<resume>')
}

async function countUserTurns(sessionId: string): Promise<number> {
  const msgs = await prisma.message.findMany({
    where: { sessionId, role: 'user' },
    select: { content: true },
  })
  return msgs.filter((m) => !isResumeMessage(m.content)).length
}

const STALE_MS = 14 * 24 * 60 * 60 * 1000

async function buildMapNodePayloads(mapId: string) {
  const [nodes, openLoops, artifacts] = await Promise.all([
    prisma.mapNode.findMany({ where: { mapId }, orderBy: { createdAt: 'asc' } }),
    prisma.loop.findMany({ where: { mapId, closedAt: null }, select: { id: true, nodeId: true, lastTouchedAt: true } }),
    prisma.artifact.findMany({ where: { node: { mapId } }, select: { nodeId: true } }),
  ])
  const loopByNode = new Map(openLoops.map((l) => [l.nodeId, l]))
  const artifactNodes = new Set(artifacts.map((a) => a.nodeId))
  const now = Date.now()
  return nodes.map((n) => {
    const loop = loopByNode.get(n.id)
    const stale = !!loop?.lastTouchedAt && now - new Date(loop.lastTouchedAt).getTime() > STALE_MS
    return {
      id: n.id,
      parentId: n.parentId,
      depth: n.depth,
      title: n.title,
      summary: n.summary,
      hookQuestion: n.hookQuestion,
      status: n.status,
      hasOpenLoop: !!loop,
      openLoopId: loop?.id ?? null,
      stale,
      hasArtifact: artifactNodes.has(n.id),
    }
  })
}

// ── onboarding (POST /api/onboard) ───────────────────────────────────────────

export interface OnboardInput {
  userId: string
  posture: Posture
  rawQuestion?: string
  startingPosition?: string
}

export async function onboard(input: OnboardInput) {
  const { userId, posture } = input
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} })

  // Challenge posture stores its starting position verbatim; other postures don't (§4).
  const startingPosition = posture === 'challenge' ? input.startingPosition ?? null : null

  const map = await prisma.map.create({
    data: {
      userId,
      title: input.rawQuestion ?? 'New question',
      heldQuestion: input.rawQuestion ?? 'New question',
      posture,
      startingPosition,
    },
  })
  const session = await prisma.session.create({ data: { userId, mapId: map.id } })
  await logEvent(session.id, 'session_start', { posture, kind: 'onboard' })

  // Sharpen (skipped for surprise-me, which uses the hardcoded rotation — §9).
  let sharpenedQuestion: string
  if (posture === 'surprise-me') {
    const idx = nextSurpriseIndex(SURPRISE_ROTATION.length)
    sharpenedQuestion = SURPRISE_ROTATION[idx]
  } else {
    sharpenedQuestion = await llm.sharpen({ sessionId: session.id }, input.rawQuestion ?? '')
  }

  await prisma.map.update({
    where: { id: map.id },
    data: { heldQuestion: sharpenedQuestion, title: sharpenedQuestion },
  })

  // Root node is current immediately; its Loop is created with it (§6.4).
  const root = await prisma.mapNode.create({
    data: {
      mapId: map.id,
      parentId: null,
      depth: 0,
      title: sharpenedQuestion,
      summary: sharpenedQuestion,
      hookQuestion: sharpenedQuestion,
      status: 'current',
    },
  })
  await prisma.loop.create({
    data: {
      mapId: map.id,
      nodeId: root.id,
      question: root.hookQuestion,
      openedBy: 'reader_drift',
      openedInSessionId: session.id,
      openedAtTurn: 0,
    },
  })
  await logEvent(session.id, 'loop_opened', { nodeId: root.id, kind: 'root' })

  // Fire-and-forget seed generation, registered for the turn-2 seed-await (G-06).
  const seedPromise = runSeedJob(session.id, map.id, sharpenedQuestion, root.id, root.depth)
  setPendingSeed(map.id, seedPromise)

  return { mapId: map.id, sessionId: session.id, sharpenedQuestion }
}

async function runSeedJob(
  sessionId: string,
  mapId: string,
  rootQuestion: string,
  rootId: string,
  rootDepth: number
): Promise<void> {
  try {
    const out = await llm.generatorMap(
      { sessionId },
      { node: { title: rootQuestion, summary: rootQuestion }, direction: 'branch', rootQuestion, existingTitles: [], seed: true },
      true
    )
    const nodes = (out.nodes ?? []).slice(0, 6)
    for (const n of nodes) {
      await prisma.mapNode.create({
        data: {
          mapId,
          parentId: rootId,
          depth: rootDepth + 1,
          title: n.title,
          summary: n.summary,
          hookQuestion: n.hookQuestion,
          status: 'frontier',
        },
      })
    }
  } catch (e) {
    await logEvent(sessionId, 'generation_failed', { kind: 'seed', error: String(e) })
  }
}

// ── session resolution (idle / return) ───────────────────────────────────────

export interface ResolvedTurn {
  session: { id: string; mapId: string; userId: string }
  isReturnTurn1: boolean
  viaShelf: boolean
}

export class TurnError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function resolveSession(incomingSessionId: string, viaShelf?: boolean): Promise<ResolvedTurn> {
  const session = await prisma.session.findUnique({ where: { id: incomingSessionId } })
  if (!session) throw new TurnError(404, 'session not found')

  if (session.endedAt) {
    // Resuming an ended session = a return (shelf by default). Profiler already ran.
    const next = await createReturnSession(session, viaShelf ?? true)
    return { session: next, isReturnTurn1: true, viaShelf: viaShelf ?? true }
  }

  // Active session — check idle boundary (time since last *user* message).
  const lastUser = await prisma.message.findFirst({
    where: { sessionId: session.id, role: 'user', NOT: { content: { startsWith: '<resume>' } } },
    orderBy: { createdAt: 'desc' },
  })
  if (lastUser && Date.now() - new Date(lastUser.createdAt).getTime() > IDLE_MS) {
    // Idle close: run step 8 on the old session, then a return session. Typed-after-idle
    // is NOT a shelf return (G-17): viaShelf=false.
    await endSessionPipeline(session.id)
    const next = await createReturnSession(session, false)
    return { session: next, isReturnTurn1: true, viaShelf: false }
  }

  return { session, isReturnTurn1: false, viaShelf: false }
}

async function createReturnSession(
  old: { id: string; mapId: string; userId: string; synthesisFired: boolean; synthesisCaptured: boolean },
  viaShelf: boolean
) {
  const map = await prisma.map.findUnique({ where: { id: old.mapId } })
  if (!map) throw new TurnError(404, 'map not found')

  // Synthesis inheritance (G-07): inherit true only if the prior session fired
  // synthesis and captured nothing (never re-ask an unanswered question).
  const inheritSynthesis = old.synthesisFired && !old.synthesisCaptured

  const next = await prisma.session.create({
    data: { userId: old.userId, mapId: old.mapId, isReturn: true, viaShelf, synthesisFired: inheritSynthesis },
  })
  await logEvent(next.id, 'session_start', { kind: 'return', viaShelf })

  // Inject the <resume> block as the first (user-role) message of the new session (§5).
  const openLoops = await prisma.loop.findMany({
    where: { mapId: map.id, closedAt: null },
    orderBy: { proximity: 'desc' },
  })
  const resume = buildResumeBlock(map.resumeSummary, openLoops, map.currentView)
  await prisma.message.create({ data: { sessionId: next.id, role: 'user', content: resume } })
  await prisma.map.update({ where: { id: map.id }, data: { lastVisitedAt: new Date() } })

  return next
}

function buildResumeBlock(
  resumeSummary: string | null,
  openLoops: Array<{ question: string; proximity: number }>,
  currentView: string | null
): string {
  let body = `<resume>\n${resumeSummary ?? 'Returning to this map.'}`
  if (openLoops.length) {
    body += `\nOpen loops:`
    for (const l of openLoops) body += `\n- ${l.question} (proximity ${l.proximity.toFixed(2)})`
  }
  if (currentView) body += `\nWhere you stand: ${currentView}`
  body += `\n</resume>`
  return body
}

// ── the per-turn streaming pipeline (POST /api/turn) ─────────────────────────

export function buildTurnStream(resolved: ResolvedTurn, message: string, viaNodeClick: boolean): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const sse = makeSse(controller)
      void pipelineTurn(sse, resolved, message, viaNodeClick).finally(() => sse.close())
    },
  })
}

async function pipelineTurn(
  sse: SseWriter,
  resolved: ResolvedTurn,
  message: string,
  viaNodeClick: boolean
): Promise<void> {
  const sessionId = resolved.session.id
  const ctx = { sessionId }
  const release = await acquireSessionLock(sessionId)
  let lockReleased = false
  const releaseLock = () => {
    if (!lockReleased) {
      lockReleased = true
      release()
    }
  }

  try {
    // STEP 1 — Ingest.
    const prevTutor = await prisma.message.findFirst({
      where: { sessionId, role: 'assistant' },
      orderBy: { createdAt: 'desc' },
    })
    if (prevTutor) {
      await logEvent(sessionId, 'reply_latency', { ms: Date.now() - new Date(prevTutor.createdAt).getTime() })
    }
    await prisma.message.create({ data: { sessionId, role: 'user', content: message } })
    await logEvent(sessionId, 'message_sent', {})

    const turnNumber = await countUserTurns(sessionId)

    // Seed-await from turn 2 on (§5 step 1).
    if (turnNumber >= 2) {
      const pending = getPendingSeed(resolved.session.mapId)
      if (pending) await pending.catch(() => {})
    }

    // Reload session + map for fresh cost / flags / startingPosition.
    let session = await prisma.session.findUnique({ where: { id: sessionId } })
    const map = await prisma.map.findUnique({ where: { id: resolved.session.mapId } })
    if (!session || !map) {
      sse.emit('done', { sessionId })
      return
    }

    // COST CEILING — detected at turn start, before the Reader (§13).
    if (session.costLocked || session.costUsd >= SESSION_COST_LIMIT_USD) {
      await runCeilingBranch(sse, sessionId)
      return
    }

    const isTurn1 = turnNumber === 1
    const synthesisPending = session.lastDirectiveSynthesis === true

    // STEP 2 — Reader (skipped on turn 1).
    let reader: ReaderOutput | null = null
    if (!isTurn1) {
      try {
        reader = await llm.reader(ctx, await buildReaderInput(map, sessionId, synthesisPending))
      } catch (e) {
        if (e instanceof MockQueueEmptyError) {
          await logEvent(sessionId, 'mock_queue_empty', { role: 'reader' })
          sse.emit('done', { sessionId })
          return
        }
        // G-16: proceed with neutral signals.
        await logEvent(sessionId, 'reader_failed', { error: String(e) })
        reader = neutralReader()
      }
    }

    // STEP 3 — Apply the read (code, not LLM).
    let currentNodeId: string | null = null
    if (reader) {
      currentNodeId = await applyRead(session, map, reader, turnNumber, synthesisPending, viaNodeClick)
    } else {
      const cur = await prisma.mapNode.findFirst({ where: { mapId: map.id, status: 'current' } })
      currentNodeId = cur?.id ?? null
    }

    // STEP 4 — Director.
    const offMap = reader?.conversationNodeId === null && reader !== null && !isTurn1
    const directorInput = await buildDirectorInput(session, map, reader, currentNodeId, resolved, isTurn1, turnNumber)
    let dir: { tools: DirectorToolCall[]; rationale?: string }
    try {
      dir = await llm.director(ctx, directorInput)
    } catch (e) {
      if (e instanceof MockQueueEmptyError) {
        await logEvent(sessionId, 'mock_queue_empty', { role: 'director' })
        sse.emit('done', { sessionId })
        return
      }
      await logEvent(sessionId, 'director_failed', { error: String(e) })
      dir = { tools: [{ name: 'setTutorMode', input: { mode: 'explain' } }] }
    }

    const { tools, warned } = validateDirectorTools(dir.tools, isTurn1, offMap)
    if (warned) await logEvent(sessionId, 'director_warning', { reason: 'missing setTutorMode; defaulted to explain' })

    // FORCE_ARTIFACT (§16 item 3): force a spawnArtifact on the next eligible turn for
    // deterministic acceptance testing. "true" → slider-sim; a template id → that one.
    const forced = process.env.FORCE_ARTIFACT
    if (forced && !isTurn1 && !offMap && currentNodeId && !tools.some((t) => t.name === 'spawnArtifact')) {
      const tpl = forced === 'true' ? 'slider-sim' : forced
      if ((V1_TEMPLATE_IDS as readonly string[]).includes(tpl)) {
        const activeLoop = await prisma.loop.findFirst({ where: { nodeId: currentNodeId, closedAt: null } })
        const loopQuestion = activeLoop?.question ?? map.heldQuestion
        tools.splice(1, tools.length, { name: 'spawnArtifact', input: { templateId: tpl, nodeId: currentNodeId, loopQuestion } })
      }
    }

    const modeTool = tools.find((t) => t.name === 'setTutorMode')
    const note = (modeTool?.input?.note as string | undefined) ?? undefined
    const isSynthesisNote = !!note && note.toLowerCase().includes('synthesis')

    // STEP 5 — Dispatch.
    if (isSynthesisNote && !session.synthesisFired) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { synthesisFired: true, lastDirectiveSynthesis: true },
      })
      session = { ...session, synthesisFired: true, lastDirectiveSynthesis: true }
    }

    const coldGutCheck = isTurn1 && !resolved.isReturnTurn1 && map.posture !== 'challenge'
    const directive = renderDirective(tools, { offMap, isReturnTurn1: resolved.isReturnTurn1, coldGutCheck })
    const rationale = (dir.rationale ?? fallbackRationale(tools)).split(/\s+/).slice(0, 25).join(' ')

    const signals = reader
      ? { ...reader, isColdStart: false, isReturnTurn1: resolved.isReturnTurn1 }
      : {
          appetite: null,
          proximityToClose: null,
          justClosed: false,
          isColdStart: isTurn1 && !resolved.isReturnTurn1,
          isReturnTurn1: resolved.isReturnTurn1,
        }

    const decisionRow = await prisma.directorDecision.create({
      data: {
        sessionId,
        turn: turnNumber,
        signals: signals as Prisma.InputJsonValue,
        tools: tools as unknown as Prisma.InputJsonValue,
        rationale,
        directive,
        outcome: Prisma.DbNull,
      },
    })
    await logEvent(sessionId, 'director_decision', { turn: turnNumber, tools: tools.map((t) => t.name) })
    sse.emit('director_decision', { turn: turnNumber, decisionId: decisionRow.id, signals, tools, rationale })

    // Collect async generator jobs (only on non-turn-1, on-map turns — already stripped).
    const generatorJobs: Array<() => Promise<void>> = []
    for (const t of tools) {
      if (t.name === 'expandMap') {
        const nodeId = String(t.input.nodeId)
        const direction = String(t.input.direction) === 'branch' ? 'branch' : 'deepen'
        generatorJobs.push(() => runExpandMap(sse, ctx, map.id, map.heldQuestion, nodeId, direction))
      } else if (t.name === 'spawnArtifact') {
        const templateId = String(t.input.templateId)
        const nodeId = String(t.input.nodeId)
        const loopQuestion = String(t.input.loopQuestion ?? '')
        generatorJobs.push(() => runSpawnArtifact(sse, ctx, templateId, nodeId, loopQuestion, sessionId))
      }
    }

    // STEP 6 — Tutor (Sonnet, streams).
    const history = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    })
    const messagesForTutor = buildTutorMessages(history, directive)
    const firstSession = !resolved.isReturnTurn1 && (await prisma.session.count({ where: { mapId: map.id } })) === 1

    let firstDeltaLogged = false
    const turnStart = Date.now()
    let tutorText: string
    try {
      const out = await llm.tutorStream(ctx, { messages: messagesForTutor, firstSession }, (delta) => {
        if (!firstDeltaLogged) {
          firstDeltaLogged = true
          void logEvent(sessionId, 'ttft', { ms: Date.now() - turnStart })
        }
        sse.emit('tutor_delta', { text: delta })
      })
      tutorText = out.text
    } catch (e) {
      if (e instanceof MockQueueEmptyError) {
        await logEvent(sessionId, 'mock_queue_empty', { role: 'tutor' })
        sse.emit('done', { sessionId })
        return
      }
      throw e
    }
    await prisma.message.create({ data: { sessionId, role: 'assistant', content: tutorText } })

    sse.emit('loop_state', {
      proximityToClose: reader?.proximityToClose ?? null,
      justClosed: reader?.justClosed ?? false,
      nodeId: currentNodeId,
    })
    sse.emit('map_update', { nodes: await buildMapNodePayloads(map.id) })

    // Critical section done — release the lock so a fast next message never waits on
    // generation (§5). The stream stays open until generators + safety complete.
    releaseLock()

    // STEP 7 — Post-turn (async, within the stream).
    if (generatorJobs.length) {
      await Promise.race([
        Promise.allSettled(generatorJobs.map((j) => j())),
        new Promise((r) => setTimeout(r, GENERATOR_CAP_MS)),
      ])
    }

    // Safety check over the reply (§7.7).
    try {
      const sf = await llm.safety(ctx, { reply: tutorText, userMessage: message })
      if (sf.flag && sf.note) {
        await logEvent(sessionId, 'safety_flag', { category: sf.category })
        sse.emit('safety_note', { text: sf.note })
      }
    } catch (e) {
      await logEvent(sessionId, 'safety_failed', { error: String(e) })
    }

    const fresh = await prisma.session.findUnique({ where: { id: sessionId } })
    sse.emit('cost', { sessionTotalUsd: fresh?.costUsd ?? 0 })
    await logEvent(sessionId, 'cost_tick', { costUsd: fresh?.costUsd ?? 0 })
    sse.emit('done', { sessionId })
  } catch (e) {
    await logEvent(sessionId, 'pipeline_error', { error: String(e) })
    sse.emit('done', { sessionId })
  } finally {
    releaseLock()
  }
}

async function runCeilingBranch(sse: SseWriter, sessionId: string): Promise<void> {
  await prisma.session.update({ where: { id: sessionId }, data: { costLocked: true } })
  await logEvent(sessionId, 'cost_locked', {})
  // Hardcoded wrap-up streamed directly (no Tutor call → zero model calls, §13).
  const n = COST_LOCK_WRAP_UP.length
  const chunks = [COST_LOCK_WRAP_UP.slice(0, Math.floor(n / 3)), COST_LOCK_WRAP_UP.slice(Math.floor(n / 3), Math.floor((2 * n) / 3)), COST_LOCK_WRAP_UP.slice(Math.floor((2 * n) / 3))]
  for (const c of chunks) {
    sse.emit('tutor_delta', { text: c })
    await new Promise((r) => setTimeout(r, 5))
  }
  await prisma.message.create({ data: { sessionId, role: 'assistant', content: COST_LOCK_WRAP_UP } })
  const fresh = await prisma.session.findUnique({ where: { id: sessionId } })
  sse.emit('cost', { sessionTotalUsd: fresh?.costUsd ?? 0 })
  sse.emit('done', { sessionId })
}

// ── step 3: apply the read (§6.4 lifecycle) ──────────────────────────────────

async function applyRead(
  session: { id: string },
  map: { id: string; startingPosition: string | null },
  reader: ReaderOutput,
  turn: number,
  synthesisPending: boolean,
  viaNodeClick: boolean
): Promise<string | null> {
  const S = session.id
  let currentNode = await prisma.mapNode.findFirst({ where: { mapId: map.id, status: 'current' } })

  // (a) justClosed first — so chain detection in (b) sees the close.
  if (reader.justClosed && reader.closedLoopId) {
    const loop = await prisma.loop.findUnique({ where: { id: reader.closedLoopId } })
    if (loop && !loop.closedAt) {
      await prisma.loop.update({
        where: { id: loop.id },
        data: { closedAt: new Date(), closedBy: 'reader', closedInSessionId: S, closedAtTurn: turn },
      })
      await prisma.mapNode.update({ where: { id: loop.nodeId }, data: { status: 'settled' } })
      incrLoopsClosed(S)
      await logEvent(S, 'loop_closed', { loopId: loop.id, by: 'reader' })
      // positionShift gate keys on startingPosition presence, not posture (G-23).
      if (map.startingPosition && reader.positionShift) {
        await prisma.loop.update({ where: { id: loop.id }, data: { positionShift: reader.positionShift } })
      }
      if (currentNode && currentNode.id === loop.nodeId) currentNode = null
    }
  }

  // (b) conversation-node transition.
  const cid = reader.conversationNodeId
  const offMap = cid === null
  if (!offMap && cid) {
    if (!currentNode || cid !== currentNode.id) {
      const target = await prisma.mapNode.findUnique({ where: { id: cid } })
      if (target && target.mapId === map.id && target.status !== 'settled') {
        if (currentNode && currentNode.id !== target.id) {
          await prisma.mapNode.update({ where: { id: currentNode.id }, data: { status: 'visited' } })
        }
        await prisma.mapNode.update({ where: { id: target.id }, data: { status: 'current' } })
        await logEvent(S, 'node_enter', { nodeId: target.id })
        currentNode = { ...target, status: 'current' }

        const existingOpen = await prisma.loop.findFirst({ where: { nodeId: target.id, closedAt: null } })
        if (!existingOpen) {
          // Chain detection: most recent reader-close in this session within 2 turns (G-01/G-03).
          const src = await prisma.loop.findFirst({
            where: { mapId: map.id, closedBy: 'reader', closedInSessionId: S, NOT: { closedAtTurn: null } },
            orderBy: { closedAt: 'desc' },
          })
          let chainedFromLoopId: string | null = null
          if (src && src.closedAtTurn != null && turn - src.closedAtTurn <= 2 && turn - src.closedAtTurn >= 0) {
            chainedFromLoopId = src.id
          }
          const prevDecision = await prisma.directorDecision.findFirst({
            where: { sessionId: S, turn: turn - 1 },
          })
          const prevBranch =
            prevDecision &&
            Array.isArray(prevDecision.tools) &&
            (prevDecision.tools as Array<{ name?: string; input?: { direction?: string } }>).some(
              (t) => t.name === 'expandMap' && t.input?.direction === 'branch'
            )
          const openedBy = viaNodeClick ? 'user_click' : prevBranch ? 'director_branch' : 'reader_drift'
          await prisma.loop.create({
            data: {
              mapId: map.id,
              nodeId: target.id,
              question: target.hookQuestion,
              openedBy,
              openedInSessionId: S,
              openedAtTurn: turn,
              chainedFromLoopId,
            },
          })
          await logEvent(S, 'loop_opened', { nodeId: target.id, chainedFromLoopId, openedBy })
        }
      }
    }
  }

  // (c) proximity write (skipped on off-map — G-11).
  if (!offMap && currentNode) {
    const activeLoop = await prisma.loop.findFirst({ where: { nodeId: currentNode.id, closedAt: null } })
    if (activeLoop) {
      await prisma.loop.update({
        where: { id: activeLoop.id },
        data: { proximity: reader.proximityToClose, lastTouchedAt: new Date() },
      })
    }
  }

  // (d) inferredPosition — write once, never overwrite (G-23). Gated on the value
  //     loaded at turn start so it can't race with (a)'s positionShift.
  if (reader.inferredPosition && !map.startingPosition) {
    await prisma.map.update({ where: { id: map.id }, data: { startingPosition: reader.inferredPosition } })
  }

  // (e) synthesisAnswer (§5 step 3).
  if (synthesisPending) {
    if (reader.synthesisAnswer != null && reader.synthesisAnswer !== '') {
      await prisma.map.update({ where: { id: map.id }, data: { currentView: reader.synthesisAnswer } })
      await prisma.viewSnapshot.create({ data: { mapId: map.id, content: reader.synthesisAnswer, sessionId: S } })
      await prisma.session.update({ where: { id: S }, data: { synthesisCaptured: true } })
    }
    // Either way, a deflected synthesis question is not re-armed.
    await prisma.session.update({ where: { id: S }, data: { lastDirectiveSynthesis: false } })
  }

  // (f) outcome backfill on the prior decision (G-04).
  const candidates = await prisma.directorDecision.findMany({
    where: { sessionId: S, turn: { lt: turn } },
    orderBy: { turn: 'desc' },
  })
  const target = candidates.find((d) => d.outcome === null || d.outcome === undefined)
  if (target) {
    await prisma.directorDecision.update({
      where: { id: target.id },
      data: {
        outcome: {
          nextAppetite: reader.appetite,
          nextProximity: reader.proximityToClose,
          nextJustClosed: reader.justClosed,
        },
      },
    })
  }

  return currentNode?.id ?? null
}

// ── director validation + directive rendering (§5 step 4, §6.2) ──────────────

function validateDirectorTools(
  raw: DirectorToolCall[],
  isTurn1: boolean,
  offMap: boolean
): { tools: DirectorToolCall[]; warned: boolean } {
  let warned = false
  let tools = [...(raw ?? [])]

  let modeTool = tools.find((t) => t.name === 'setTutorMode')
  if (!modeTool) {
    modeTool = { name: 'setTutorMode', input: { mode: 'explain' } }
    tools.unshift(modeTool)
    warned = true
  }
  // Validate mode value.
  if (!VALID_MODES.includes(modeTool.input.mode as TutorMode)) {
    modeTool.input.mode = 'explain'
  }
  // Cap at 2 calls, keeping setTutorMode.
  const others = tools.filter((t) => t !== modeTool)
  tools = [modeTool, ...others].slice(0, 2)
  // Strip map/artifact tools on turn 1 and off-map turns (enforcement, not just prompt).
  if (isTurn1 || offMap) {
    tools = tools.filter((t) => t.name !== 'expandMap' && t.name !== 'spawnArtifact')
  }
  return { tools, warned }
}

function renderDirective(
  tools: DirectorToolCall[],
  opts: { offMap: boolean; isReturnTurn1: boolean; coldGutCheck: boolean }
): string {
  const modeTool = tools.find((t) => t.name === 'setTutorMode')
  const mode = (modeTool?.input?.mode as string) ?? 'explain'
  const note = modeTool?.input?.note as string | undefined
  const caution = tools.find((t) => t.name === 'raiseCaution')?.input?.note as string | undefined

  let s = `<director_instruction>\nMode: ${mode}`
  if (note) s += `\nNote: ${note}`
  if (caution) s += `\nCaution: ${caution}`
  if (opts.coldGutCheck) s += `\nAfter the opening hook lands, add one light gut-check — which way are they leaning right now?`
  if (opts.isReturnTurn1) s += `\nWelcome back — open with a brief re-hook of the brightest open loop, by name.`
  if (opts.offMap) s += `\n${OFF_MAP_SCRIPT}`
  s += `\n(Advisory about style only; the duty of care in your system prompt overrides this.)\n</director_instruction>`
  return s
}

function fallbackRationale(tools: DirectorToolCall[]): string {
  const mode = (tools.find((t) => t.name === 'setTutorMode')?.input?.mode as string) ?? 'explain'
  const extra = tools.find((t) => t.name === 'expandMap')
    ? ' and growing the map'
    : tools.find((t) => t.name === 'spawnArtifact')
      ? ' and spawning an interactive'
      : ''
  return `Setting mode to ${mode}${extra} to match where the reader is right now.`
}

// ── generator jobs (step 7) ──────────────────────────────────────────────────

async function runExpandMap(
  sse: SseWriter,
  ctx: { sessionId: string },
  mapId: string,
  rootQuestion: string,
  nodeId: string,
  direction: 'deepen' | 'branch'
): Promise<void> {
  try {
    const node = await prisma.mapNode.findUnique({ where: { id: nodeId } })
    if (!node || node.mapId !== mapId) {
      await logEvent(ctx.sessionId, 'generation_failed', { kind: 'map', reason: 'node not found' })
      return
    }
    if (node.depth >= 4) return // depth cap (§6.2)
    const existing = await prisma.mapNode.findMany({ where: { mapId }, select: { title: true } })
    const out = await llm.generatorMap(
      ctx,
      { node: { title: node.title, summary: node.summary }, direction, rootQuestion, existingTitles: existing.map((e) => e.title) },
      false
    )
    const nodes = (out.nodes ?? []).slice(0, 4)
    const created = []
    for (const n of nodes) {
      created.push(
        await prisma.mapNode.create({
          data: { mapId, parentId: node.id, depth: node.depth + 1, title: n.title, summary: n.summary, hookQuestion: n.hookQuestion, status: 'frontier' },
        })
      )
    }
    if (created.length) sse.emit('map_update', { nodes: await buildMapNodePayloads(mapId) })
  } catch (e) {
    await logEvent(ctx.sessionId, 'generation_failed', { kind: 'map', error: String(e) })
  }
}

async function runSpawnArtifact(
  sse: SseWriter,
  ctx: { sessionId: string },
  templateId: string,
  nodeId: string,
  loopQuestion: string,
  sessionId: string
): Promise<void> {
  try {
    const schema = (TEMPLATE_SCHEMAS as Record<string, { safeParse: (v: unknown) => { success: boolean; data?: unknown } }>)[templateId]
    if (!schema) {
      await logEvent(sessionId, 'generation_failed', { kind: 'artifact', reason: 'unknown template' })
      return
    }
    const node = await prisma.mapNode.findUnique({ where: { id: nodeId } })
    if (!node) {
      await logEvent(sessionId, 'generation_failed', { kind: 'artifact', reason: 'node not found' })
      return
    }
    const props = await llm.generatorArtifact(ctx, {
      templateId,
      propSpec: TEMPLATE_PROMPT_SPECS[templateId] ?? '',
      node: { title: node.title, summary: node.summary },
      loopQuestion,
    })
    if (!props) {
      await logEvent(sessionId, 'generation_failed', { kind: 'artifact', reason: 'null props' })
      return
    }
    const parsed = schema.safeParse(props)
    if (!parsed.success) {
      await logEvent(sessionId, 'generation_failed', { kind: 'artifact', reason: 'invalid props' })
      return
    }
    const artifact = await prisma.artifact.create({
      data: { nodeId, sessionId, templateId, props: parsed.data as object, loopQuestion, status: 'ready' },
    })
    sse.emit('artifact_ready', { artifact })
    // Artifact safety pass (G-22): the props JSON is the reply under review.
    try {
      const sf = await llm.safety(ctx, { reply: JSON.stringify(props), artifact: true })
      if (sf.flag && sf.note) {
        await logEvent(sessionId, 'safety_flag', { category: sf.category, artifactId: artifact.id })
        sse.emit('safety_note', { text: sf.note, artifactId: artifact.id })
      }
    } catch {
      /* artifact safety is non-critical */
    }
  } catch (e) {
    await logEvent(sessionId, 'generation_failed', { kind: 'artifact', error: String(e) })
  }
}

// ── reader / director input builders ─────────────────────────────────────────

async function buildReaderInput(
  map: { id: string; startingPosition: string | null },
  sessionId: string,
  synthesisPending: boolean
) {
  const [lastTutor, lastUser, openLoops, nonSettled] = await Promise.all([
    prisma.message.findFirst({ where: { sessionId, role: 'assistant' }, orderBy: { createdAt: 'desc' } }),
    prisma.message.findFirst({ where: { sessionId, role: 'user', NOT: { content: { startsWith: '<resume>' } } }, orderBy: { createdAt: 'desc' } }),
    prisma.loop.findMany({ where: { mapId: map.id, closedAt: null } }),
    prisma.mapNode.findMany({ where: { mapId: map.id, status: { not: 'settled' } } }),
  ])
  return {
    guideMessage: lastTutor?.content ?? '',
    userReply: lastUser?.content ?? '',
    loops: openLoops.map((l) => ({ loopId: l.id, nodeId: l.nodeId, question: l.question, proximity: l.proximity })),
    nodes: nonSettled.map((n) => ({ nodeId: n.id, title: n.title, status: n.status })),
    startingPosition: map.startingPosition ?? null,
    synthesisPending,
  }
}

async function buildDirectorInput(
  session: { costUsd: number; synthesisFired: boolean },
  map: { id: string; posture: string; startingPosition: string | null; currentView: string | null },
  reader: ReaderOutput | null,
  currentNodeId: string | null,
  resolved: ResolvedTurn,
  isTurn1: boolean,
  turn: number
) {
  const openLoops = await prisma.loop.findMany({ where: { mapId: map.id, closedAt: null } })
  const userModel = (await prisma.userModel.findUnique({ where: { userId: resolved.session.userId } }))?.data ?? null
  const lastTwo = await prisma.message.findMany({ where: { sessionId: resolved.session.id }, orderBy: { createdAt: 'desc' }, take: 4 })
  return {
    reader: reader ?? { appetite: null, proximityToClose: null, justClosed: false },
    isColdStart: isTurn1 && !resolved.isReturnTurn1,
    isReturnTurn1: resolved.isReturnTurn1,
    viaShelf: resolved.viaShelf,
    currentNodeId,
    loopLedger: openLoops.map((l) => ({ loopId: l.id, nodeId: l.nodeId, question: l.question, proximity: l.proximity })),
    danglingCount: openLoops.length,
    mapContext: {
      posture: map.posture,
      startingPosition: map.startingPosition,
      currentView: map.currentView,
      loopsClosedThisSession: getLoopsClosed(resolved.session.id),
      synthesisFiredThisSession: session.synthesisFired,
    },
    userModel,
    costUsd: session.costUsd,
    costNearCeiling: session.costUsd >= SESSION_COST_NEAR_USD,
    lastExchanges: lastTwo.reverse().map((m) => ({ role: m.role, content: m.content })),
    turn,
  }
}

function buildTutorMessages(
  history: Array<{ role: string; content: string }>,
  directive: string
): Array<{ role: string; content: string }> {
  const msgs = history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
  // Directive rides in the final block after the latest user message (§14 cache discipline).
  if (msgs.length && msgs[msgs.length - 1].role === 'user') {
    msgs[msgs.length - 1] = { role: 'user', content: `${msgs[msgs.length - 1].content}\n\n${directive}` }
  } else {
    msgs.push({ role: 'user', content: directive })
  }
  return msgs
}

function neutralReader(): ReaderOutput {
  return {
    appetite: 'neutral',
    proximityToClose: 0,
    justClosed: false,
    closedLoopId: null,
    conversationNodeId: null,
    positionShift: null,
    inferredPosition: null,
    synthesisAnswer: null,
    evidence: 'reader unavailable; neutral defaults',
  }
}

// ── session end (step 8) ─────────────────────────────────────────────────────

export interface SessionMetrics {
  sessionId: string
  loopsClosed: number
  loopsChained: number
  loopsDangling: number
  activeSeconds: number
  costUsd: number
}

export async function endSessionPipeline(sessionId: string): Promise<SessionMetrics | null> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!session) return null
  const map = await prisma.map.findUnique({ where: { id: session.mapId } })
  if (!map) return null

  // Already ended → return current metrics (idempotent).
  if (session.endedAt) {
    return {
      sessionId,
      loopsClosed: session.loopsClosed,
      loopsChained: session.loopsChained,
      loopsDangling: session.loopsDangling,
      activeSeconds: session.activeSeconds,
      costUsd: session.costUsd,
    }
  }

  // Profiler — on failure, fall back (G-09) so the welcome-back beat is never empty.
  let resumeSummary: string
  try {
    const out = await llm.profiler(
      { sessionId },
      await buildProfilerInput(sessionId, session.userId, map.id)
    )
    resumeSummary = out.resumeSummary
    await prisma.userModel.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, data: out.data as object },
      update: { data: out.data as object },
    })
  } catch (e) {
    await logEvent(sessionId, 'profiler_failed', { error: String(e) })
    resumeSummary = await fallbackResume(map.id)
  }
  await prisma.map.update({ where: { id: map.id }, data: { resumeSummary, lastVisitedAt: new Date() } })

  // Rollup metrics (§12, G-02/G-10/G-14).
  const loopsClosed = await prisma.loop.count({ where: { mapId: map.id, closedInSessionId: sessionId } })
  const chainers = await prisma.loop.findMany({
    where: { openedInSessionId: sessionId, NOT: { chainedFromLoopId: null } },
    select: { chainedFromLoopId: true },
  })
  const loopsChained = new Set(chainers.map((c) => c.chainedFromLoopId)).size
  const loopsDangling = await prisma.loop.count({ where: { openedInSessionId: sessionId, closedAt: null } })
  const activeSeconds = await computeActiveSeconds(sessionId)

  await prisma.session.update({
    where: { id: sessionId },
    data: { endedAt: new Date(), loopsClosed, loopsChained, loopsDangling, activeSeconds },
  })
  await logEvent(sessionId, 'session_end', { loopsClosed, loopsChained, loopsDangling, activeSeconds })

  return { sessionId, loopsClosed, loopsChained, loopsDangling, activeSeconds, costUsd: session.costUsd }
}

async function fallbackResume(mapId: string): Promise<string> {
  const openLoops = await prisma.loop.findMany({
    where: { mapId, closedAt: null },
    orderBy: { proximity: 'desc' },
    take: 2,
  })
  if (openLoops.length === 0) return 'Fresh start — no open threads; offer something new.'
  const names = openLoops.map((l) => `"${l.question}"`).join(openLoops.length > 1 ? ' and ' : '')
  return `Picking back up — the brightest open thread${openLoops.length > 1 ? 's are' : ' is'} ${names}.`
}

async function computeActiveSeconds(sessionId: string): Promise<number> {
  const events = await prisma.event.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
  let total = 0
  for (let i = 1; i < events.length; i++) {
    const gap = (new Date(events[i].createdAt).getTime() - new Date(events[i - 1].createdAt).getTime()) / 1000
    total += Math.min(Math.max(gap, 0), 300)
  }
  return Math.round(total)
}

async function buildProfilerInput(sessionId: string, userId: string, mapId: string) {
  const [messages, decisions, closedLoops, priorModel] = await Promise.all([
    prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, select: { role: true, content: true } }),
    prisma.directorDecision.findMany({ where: { sessionId }, orderBy: { turn: 'asc' } }),
    prisma.loop.findMany({ where: { mapId, closedInSessionId: sessionId } }),
    prisma.userModel.findUnique({ where: { userId } }),
  ])
  return {
    transcript: messages,
    decisions: decisions.map((d) => ({ turn: d.turn, tools: d.tools, rationale: d.rationale })),
    closedLoops: closedLoops.map((l) => ({ question: l.question, positionShift: l.positionShift })),
    priorModel: priorModel?.data ?? null,
  }
}

// ── soft-close (POST /api/loop/[loopId]/soft-close) ──────────────────────────

export async function softClose(loopId: string, sessionId: string): Promise<{ ok: boolean }> {
  const loop = await prisma.loop.findUnique({ where: { id: loopId } })
  if (!loop) throw new TurnError(404, 'loop not found')
  const turn = await countUserTurns(sessionId)
  if (!loop.closedAt) {
    await prisma.loop.update({
      where: { id: loopId },
      data: { closedAt: new Date(), closedBy: 'user', closedInSessionId: sessionId, closedAtTurn: turn },
    })
    await prisma.mapNode.update({ where: { id: loop.nodeId }, data: { status: 'settled' } })
    await logEvent(sessionId, 'loop_closed', { loopId, by: 'user' })
  }
  return { ok: true }
}

// ── map snapshot (GET /api/map/[mapId]) ──────────────────────────────────────

export async function buildMapSnapshot(mapId: string) {
  const map = await prisma.map.findUnique({ where: { id: mapId } })
  if (!map) return null
  const [nodes, loops, artifacts, viewSnapshots] = await Promise.all([
    buildMapNodePayloads(mapId),
    prisma.loop.findMany({ where: { mapId } }),
    prisma.artifact.findMany({ where: { node: { mapId } }, orderBy: { createdAt: 'asc' } }),
    prisma.viewSnapshot.findMany({ where: { mapId }, orderBy: { createdAt: 'desc' } }),
  ])
  return { map, nodes, loops, artifacts, viewSnapshots }
}

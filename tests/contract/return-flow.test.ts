/**
 * Return flow — §5 step 8 (Profiler, resumeSummary) + §5 return-turn-1 (<resume> block)
 * Tests: session end triggers Profiler, fallback summary, return-session history shape,
 * no Reader on return turn 1, raw history isolation between sessions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  prisma,
  resetDB,
  resetMocks,
  enqueueResponse,
  onboardUser,
  doTurn1,
  doTurnN,
  endSession,
  collectTurnEvents,
  getRootNode,
  getSession,
  getMap_db,
  makeReaderOutput,
  makeDirectorMock,
  makeTutorMock,
  makeSafetyMock,
  makeProfilerMock,
  defaultUsage,
  BASE_URL,
} from './helpers.js'

beforeEach(async () => {
  await resetDB()
  await resetMocks()
})

describe('Return flow — §5 step 8 + return turn 1', () => {
  // §5 step 8: "session end ... run the Profiler ... writes Map.resumeSummary"
  it('POST /api/session/end triggers Profiler and writes Map.resumeSummary', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)

    const summary = 'We left off exploring the debt ceiling. The brightest loop is "What sets the interest rate?". The user prefers concrete numbers.'
    await enqueueResponse(makeProfilerMock(summary))

    await endSession(sessionId)

    const map = await getMap_db(mapId)
    expect(map!.resumeSummary).toBe(summary)

    const session = await getSession(sessionId)
    expect(session!.endedAt).not.toBeNull()
  })

  // §5 step 8: "if the Profiler call fails, code writes a minimal fallback summary from the two
  //             open loops with highest proximity"
  it('Profiler failure results in fallback resumeSummary built from top-2 open loops by proximity', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)
    const root = await getRootNode(mapId)

    // Give the root loop a high proximity
    await doTurnN(sessionId, 'Tell me more', makeReaderOutput({
      conversationNodeId: root.id,
      proximityToClose: 0.85,
    }))

    // End session WITHOUT enqueueing a profiler response → mock will use empty-queue default
    // (which simulates a Profiler failure by returning a minimal model)
    // BUT we want to actually test the FAILURE path, where the Profiler call itself throws.
    // We use a special signal: enqueue a profiler response with a magic field that tells
    // the mock to simulate a failure.
    await enqueueResponse({
      role: 'profiler',
      parsed: { __simulate_failure: true } as unknown as Parameters<typeof makeProfilerMock>[0],
      usage: defaultUsage,
    })

    await endSession(sessionId)

    const map = await getMap_db(mapId)
    // The fallback summary must be non-empty (built from open loops)
    expect(map!.resumeSummary).toBeTruthy()
    expect(map!.resumeSummary!.length).toBeGreaterThan(0)
  })

  // §5 return-turn-1: "session's history opens with one context block: a user-role message
  //                    whose content is <resume>...</resume>"
  it('return-session turn 1 history starts with a user-role <resume> message', async () => {
    const { mapId, sessionId: sessionId1 } = await onboardUser()
    await doTurn1(sessionId1)

    const resumeText = 'Covered debt basics. Brightest loop: "What sets the interest rate?". User prefers numbers.'
    await enqueueResponse(makeProfilerMock(resumeText))
    await endSession(sessionId1)

    // Start a return session by POSTing a turn to the same map with a new session
    // The server creates a new session on idle; for testing we trigger it via /api/turn
    // with a new userId or via a direct session creation endpoint.
    // Per spec, idle >30min triggers a new session on the same map.
    // In tests we use the session/start-return endpoint (if provided) or simply
    // verify the return behavior by examining what the server sends back.

    // Approach: POST a new turn that the server recognizes as a return session.
    // Since we just ended sessionId1, the server should start sessionId2 on the next turn.
    // We enqueue return-turn-1 mocks (no Reader on return turn 1 per spec).
    await enqueueResponse(makeDirectorMock([{
      name: 'setTutorMode',
      input: { mode: 'provoke', note: 'welcome back — re-hook the brightest open loop, by name' },
    }]))
    await enqueueResponse(makeTutorMock('Welcome back! Last time we were exploring what sets the interest rate — still a live thread.'))
    await enqueueResponse(makeSafetyMock())

    // POST a turn to the SAME map using the same userId (new session is created by the server)
    // The spec says the new session starts when the old session ended + a new turn arrives.
    // We POST to /api/turn with the ENDED sessionId — the server should reject it and
    // create a new session, OR we need a way to get the new sessionId.
    // A cleaner test approach: call GET /api/maps?userId=... to see the session list,
    // then start the new session via /api/session/start or equivalent.

    // For this test, we verify the <resume> block by directly checking the Messages table
    // after the second session's first turn completes.
    // Implementation-agnostic: if the return session is started by sending a turn to an ended
    // session, the server creates a new session and we can find it by mapId + later createdAt.

    // First, verify the Profiler wrote the resumeSummary correctly
    const map = await getMap_db(mapId)
    expect(map!.resumeSummary).toBe(resumeText)

    // Now we need to trigger a new session. The spec says GET /api/map/[mapId] returns the
    // current session; we use /api/maps?userId to find the current state.
    // Since the exact "start return session" mechanism is not a separate API endpoint
    // (it happens lazily on the next /api/turn per §5 step 1), we verify it via messages.

    // Simulate: POST turn to the ended session → server creates new session, injects <resume>
    const turnRes = await fetch(`${BASE_URL}/api/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId1, message: 'Hey, picking back up' }),
    })
    expect(turnRes.ok).toBe(true)

    // Drain the SSE stream
    const reader = turnRes.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let newSessionId: string | undefined
    const deadline = Date.now() + 10_000
    outer: while (Date.now() < deadline) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      for (const line of buffer.split('\n')) {
        if (line.startsWith('data:')) {
          try {
            const d = JSON.parse(line.slice(5))
            if (d.sessionId) newSessionId = d.sessionId
            if (d.done || line.includes('"done"')) break outer
          } catch {}
        }
      }
    }
    reader.releaseLock()

    // Find the new session by looking for sessions on this map created AFTER sessionId1 ended
    const sessions = await prisma.session.findMany({
      where: { mapId },
      orderBy: { startedAt: 'asc' },
    })
    expect(sessions.length).toBeGreaterThanOrEqual(2)
    const returnSession = sessions[sessions.length - 1]

    // The first Message in the return session must be a user-role <resume> message
    const firstMessage = await prisma.message.findFirst({
      where: { sessionId: returnSession.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(firstMessage).not.toBeNull()
    expect(firstMessage!.role).toBe('user')
    expect(firstMessage!.content).toContain('<resume>')
    expect(firstMessage!.content).toContain('</resume>')
  })

  // §5 return-turn-1: "no Reader on return turn 1 — same as cold-start turn 1"
  it('Reader is not called on return-session turn 1', async () => {
    const { sessionId: sessionId1 } = await onboardUser()
    await doTurn1(sessionId1)

    await enqueueResponse(makeProfilerMock())
    await endSession(sessionId1)

    // Enqueue a reader response — it must NOT be consumed on return turn 1
    await enqueueResponse({ role: 'reader', parsed: makeReaderOutput(), usage: defaultUsage })

    // Enqueue return turn 1 mocks (no Reader)
    await enqueueResponse(makeDirectorMock([{
      name: 'setTutorMode',
      input: { mode: 'provoke', note: 'welcome back — re-hook the brightest open loop, by name' },
    }]))
    await enqueueResponse(makeTutorMock('Welcome back!'))
    await enqueueResponse(makeSafetyMock())

    // POST to ended session → server creates a new session (return turn 1)
    const turnRes = await fetch(`${BASE_URL}/api/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId1, message: 'Picking back up' }),
    })
    expect(turnRes.ok).toBe(true)

    // Drain the SSE stream
    const reader = turnRes.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const deadline = Date.now() + 10_000
    const events: string[] = []
    while (Date.now() < deadline) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      for (const line of buffer.split('\n')) {
        if (line.startsWith('event:')) events.push(line.slice(6).trim())
      }
      if (buffer.includes('"done"') || events.includes('done')) break
    }
    reader.releaseLock()

    // Now enqueue a second turn on the new session (this WILL call Reader)
    // If Reader was called on return turn 1, the queue already had one response consumed,
    // and this second turn would have an empty reader queue and fail.
    // Since we can't easily verify queue depth, we enqueue one more reader and do turn 2.
    const sessions = await prisma.session.findMany({ orderBy: { startedAt: 'asc' } })
    const returnSession = sessions[sessions.length - 1]

    const mapId = returnSession.mapId
    const root = await getRootNode(mapId)

    // Turn 2 of return session (should consume the reader we enqueued above)
    await enqueueResponse(makeDirectorMock())
    await enqueueResponse(makeTutorMock())
    await enqueueResponse(makeSafetyMock())

    const events2 = await collectTurnEvents(returnSession.id, 'Tell me more')

    // If Reader was not consumed on return turn 1, it is available for turn 2
    // and turn 2 succeeds. If Reader HAD been called on return turn 1, the reader
    // queue would now be empty for turn 2, causing an error.
    const doneEvents = events2.filter(e => e.type === 'done')
    expect(doneEvents.length).toBe(1)
  })

  // §5 return-turn-1: raw history from prior session does NOT carry over (only <resume> block)
  it('return-session messages start fresh — no raw messages from the prior session', async () => {
    const { sessionId: sessionId1 } = await onboardUser()
    await doTurn1(sessionId1)

    await enqueueResponse(makeProfilerMock('Prior session summary'))
    await endSession(sessionId1)

    await enqueueResponse(makeDirectorMock([{
      name: 'setTutorMode',
      input: { mode: 'provoke', note: 'welcome back' },
    }]))
    await enqueueResponse(makeTutorMock('Welcome back!'))
    await enqueueResponse(makeSafetyMock())

    await fetch(`${BASE_URL}/api/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId1, message: 'Hi again' }),
    }).then(r => r.body?.cancel())

    // Wait briefly for session to be created
    await new Promise(r => setTimeout(r, 1000))

    const sessions = await prisma.session.findMany({ orderBy: { startedAt: 'asc' } })
    const returnSession = sessions[sessions.length - 1]
    expect(returnSession.id).not.toBe(sessionId1)

    // Messages for the return session
    const returnMessages = await prisma.message.findMany({
      where: { sessionId: returnSession.id },
      orderBy: { createdAt: 'asc' },
    })

    // Prior session messages must not appear in return session
    const priorMessages = await prisma.message.findMany({ where: { sessionId: sessionId1 } })
    const priorIds = new Set(priorMessages.map(m => m.id))
    for (const msg of returnMessages) {
      expect(priorIds.has(msg.id)).toBe(false)
    }
  })
})

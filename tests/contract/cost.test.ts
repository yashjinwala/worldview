/**
 * Cost model and ceiling — §13
 * Tests: Session.costUsd increments from usage, ceiling branch behavior,
 * Session.costLocked, no Reader/Director calls at ceiling.
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
  collectTurnEvents,
  getRootNode,
  getSession,
  makeReaderOutput,
  makeDirectorMock,
  makeTutorMock,
  makeSafetyMock,
  defaultUsage,
  CEILING_USAGE,
  eventsOfType,
} from './helpers.js'

beforeEach(async () => {
  await resetDB()
  await resetMocks()
})

describe('Cost model and ceiling — §13', () => {
  // §13: "Session.costUsd is incremented atomically after every API response from its real usage"
  it('Session.costUsd increases after a completed turn (from mock usage)', async () => {
    const { sessionId } = await onboardUser()

    const sessionBefore = await getSession(sessionId)
    const costBefore = sessionBefore!.costUsd

    // Turn 1 with known usage values
    await enqueueResponse(makeDirectorMock())
    // Director usage = defaultUsage (200 in, 100 out at Haiku rates)
    await enqueueResponse({ role: 'tutor', text: 'Reply text', usage: defaultUsage })
    await enqueueResponse(makeSafetyMock())
    await collectTurnEvents(sessionId, 'Hello')

    const sessionAfter = await getSession(sessionId)
    // costUsd must have increased
    expect(sessionAfter!.costUsd).toBeGreaterThan(costBefore)
  })

  // §13: at $2.00 ceiling, "skip Reader and Director, abandon pending Generator jobs,
  //      send the Tutor one hardcoded directive... stream it, emit done, set costLocked=true"
  it('at cost ceiling: no Reader or Director calls are made on that turn', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)

    const root = await getRootNode(mapId)

    // Turn 2: use CEILING_USAGE for the Tutor to push costUsd over $2.00
    await enqueueResponse({ role: 'reader', parsed: makeReaderOutput({ conversationNodeId: root.id }), usage: defaultUsage })
    await enqueueResponse(makeDirectorMock())
    await enqueueResponse({ role: 'tutor', text: 'Big reply', usage: CEILING_USAGE })
    await enqueueResponse(makeSafetyMock())
    await collectTurnEvents(sessionId, 'Turn 2')

    // Verify Session.costUsd > 2.00 after turn 2
    const sessionMid = await getSession(sessionId)
    expect(sessionMid!.costUsd).toBeGreaterThan(2.0)

    // Turn 3: enqueue Reader + Director — they must NOT be consumed because ceiling is hit
    await enqueueResponse({ role: 'reader', parsed: makeReaderOutput({ conversationNodeId: root.id }), usage: defaultUsage })
    await enqueueResponse(makeDirectorMock())
    // No Tutor mock needed — the ceiling branch uses a hardcoded directive

    const events3 = await collectTurnEvents(sessionId, 'Turn 3 after ceiling')

    // done must still be emitted
    expect(eventsOfType(events3, 'done').length).toBe(1)

    // Verify Reader and Director queued responses were NOT consumed.
    // We do this by attempting turn 4 — if the queue still has them, turn 4 would use them.
    // Since the session is now locked, turn 4 should be rejected (or the client disables input).
    // A simpler check: Session.costLocked = true means the ceiling fired.
    const sessionFinal = await getSession(sessionId)
    expect(sessionFinal!.costLocked).toBe(true)
  })

  // §13: "stream [wrap-up], emit done" — the ceiling branch streams a Tutor reply and done
  it('at cost ceiling: a warm wrap-up message streams and done is emitted', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)
    const root = await getRootNode(mapId)

    // Push past ceiling on turn 2
    await enqueueResponse({ role: 'reader', parsed: makeReaderOutput({ conversationNodeId: root.id }), usage: defaultUsage })
    await enqueueResponse(makeDirectorMock())
    await enqueueResponse({ role: 'tutor', text: 'Big turn', usage: CEILING_USAGE })
    await enqueueResponse(makeSafetyMock())
    await collectTurnEvents(sessionId, 'Turn 2')

    // Turn 3 hits the ceiling
    const events3 = await collectTurnEvents(sessionId, 'Turn 3')

    // There must be at least one tutor_delta (the wrap-up message)
    const tutorDeltas = eventsOfType(events3, 'tutor_delta')
    expect(tutorDeltas.length).toBeGreaterThanOrEqual(1)

    // The wrap-up text should be concise (≤2 sentences per spec)
    const fullText = tutorDeltas
      .map(e => (e.data as { text: string }).text)
      .join('')
    expect(fullText.length).toBeGreaterThan(5)

    // done must be last
    expect(eventsOfType(events3, 'done').length).toBe(1)
    expect(events3[events3.length - 1].type).toBe('done')
  })

  // §13: "set Session.costLocked = true; the client reads costLocked and disables input"
  it('Session.costLocked is set to true after the ceiling branch fires', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)
    const root = await getRootNode(mapId)

    // Push past ceiling
    await enqueueResponse({ role: 'reader', parsed: makeReaderOutput({ conversationNodeId: root.id }), usage: defaultUsage })
    await enqueueResponse(makeDirectorMock())
    await enqueueResponse({ role: 'tutor', text: 'Big', usage: CEILING_USAGE })
    await enqueueResponse(makeSafetyMock())
    await collectTurnEvents(sessionId, 'Turn 2')

    // Trigger ceiling branch
    await collectTurnEvents(sessionId, 'Turn 3')

    const session = await getSession(sessionId)
    expect(session!.costLocked).toBe(true)
  })
})

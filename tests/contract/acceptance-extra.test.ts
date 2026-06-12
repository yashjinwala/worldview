/**
 * ADDED by the implementer (allowed: additions only; frozen files untouched).
 * Evidence for TDD §16 item 18 behaviors that are observable under LLM_MODE=mock:
 *   - all four postures reach a streaming turn 1
 *   - Reader inferredPosition writes Map.startingPosition once and never overwrites (G-23)
 *   - a ttft Event is logged per turn (G-20)
 *   - the Conductor 👍/👎 writes a reader_disputed Event (§9, §12)
 *   - off-map turn still streams to done (§6.4)
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
  getMap_db,
  getSessionEvents,
  getLatestDirectorDecision,
  makeReaderOutput,
  eventsOfType,
  defaultUsage,
  BASE_URL,
} from './helpers.js'

beforeEach(async () => {
  await resetDB()
  await resetMocks()
})

describe('Acceptance extras (§16 item 18) — mock-observable', () => {
  it('all four postures onboard and reach a streaming turn 1', async () => {
    for (const posture of ['understand', 'challenge', 'deep-dive', 'surprise-me'] as const) {
      await resetDB()
      await resetMocks()
      const { sessionId } = await onboardUser({
        posture,
        startingPosition: posture === 'challenge' ? 'I think it is overblown' : undefined,
      })
      const events = await doTurn1(sessionId)
      expect(eventsOfType(events, 'tutor_delta').length).toBeGreaterThanOrEqual(1)
      expect(eventsOfType(events, 'done').length).toBe(1)
    }
  })

  it('Reader inferredPosition writes Map.startingPosition once and never overwrites (G-23)', async () => {
    const { mapId, sessionId } = await onboardUser({ posture: 'understand' })
    expect((await getMap_db(mapId))!.startingPosition).toBeNull()
    await doTurn1(sessionId)
    const root = await getRootNode(mapId)

    // Turn 2: Reader infers a lean → written to Map.startingPosition.
    await enqueueResponse({
      role: 'reader',
      parsed: { ...makeReaderOutput({ conversationNodeId: root.id }), inferredPosition: 'honestly it sounds overblown to me' } as never,
      usage: defaultUsage,
    })
    await doTurnNTail(sessionId, 'honestly it sounds overblown to me')
    expect((await getMap_db(mapId))!.startingPosition).toBe('honestly it sounds overblown to me')

    // Turn 3: a different inference must NOT overwrite the first.
    await enqueueResponse({
      role: 'reader',
      parsed: { ...makeReaderOutput({ conversationNodeId: root.id }), inferredPosition: 'actually maybe it is dangerous' } as never,
      usage: defaultUsage,
    })
    await doTurnNTail(sessionId, 'actually maybe it is dangerous')
    expect((await getMap_db(mapId))!.startingPosition).toBe('honestly it sounds overblown to me')
  })

  it('a ttft Event is logged on a turn (G-20)', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)
    const root = await getRootNode(mapId)
    await doTurnN(sessionId, 'more', makeReaderOutput({ conversationNodeId: root.id }))
    const ttft = await getSessionEvents(sessionId, 'ttft')
    expect(ttft.length).toBeGreaterThanOrEqual(1)
    expect(typeof (ttft[0].payload as { ms?: number }).ms).toBe('number')
  })

  it('the Conductor 👍/👎 writes a reader_disputed Event (§9, §12)', async () => {
    const { sessionId } = await onboardUser()
    await doTurn1(sessionId)
    const decision = await getLatestDirectorDecision(sessionId)
    const res = await fetch(`${BASE_URL}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, type: 'reader_disputed', payload: { decisionId: decision!.id, vote: 'down' } }),
    })
    expect(res.ok).toBe(true)
    const disputes = await getSessionEvents(sessionId, 'reader_disputed')
    expect(disputes.length).toBe(1)
    expect((disputes[0].payload as { vote?: string }).vote).toBe('down')
  })

  it('off-map turn still streams to done', async () => {
    const { sessionId } = await onboardUser()
    await doTurn1(sessionId)
    const events = await doTurnN(sessionId, 'unrelated quantum question', makeReaderOutput({ conversationNodeId: null, appetite: 'neutral' }))
    expect(eventsOfType(events, 'done').length).toBe(1)
  })
})

// Like doTurnN but the Reader response is enqueued by the caller (so it can carry fields
// the typed helper omits, e.g. inferredPosition).
async function doTurnNTail(sessionId: string, message: string) {
  await enqueueResponse({ role: 'director', tools: [{ name: 'setTutorMode', input: { mode: 'explain' } }], usage: defaultUsage })
  await enqueueResponse({ role: 'tutor', text: 'Reply.', usage: defaultUsage })
  await enqueueResponse({ role: 'safety', parsed: { flag: false, category: null, note: null }, usage: defaultUsage })
  return collectTurnEvents(sessionId, message)
}

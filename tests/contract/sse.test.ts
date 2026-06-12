/**
 * SSE event contract — §4 (SSE event types and ordering)
 * Tests: director_decision before tutor_delta, done always emitted, generation_failed logged,
 * hasOpenLoop in map_update, upsert-by-id idempotency.
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
  getSessionEvents,
  getOpenLoopForNode,
  makeReaderOutput,
  makeDirectorMock,
  makeTutorMock,
  makeSafetyMock,
  defaultUsage,
  eventsOfType,
  firstEventOfType,
} from './helpers.js'

beforeEach(async () => {
  await resetDB()
  await resetMocks()
})

describe('SSE event contract — §4', () => {
  // §4: "director_decision {signals, tools, rationale} — sent before text"
  it('director_decision event arrives before the first tutor_delta event', async () => {
    const { sessionId } = await onboardUser()

    await enqueueResponse(makeDirectorMock())
    await enqueueResponse(makeTutorMock())
    await enqueueResponse(makeSafetyMock())

    const events = await collectTurnEvents(sessionId, 'Hello')

    const ddIdx = events.findIndex(e => e.type === 'director_decision')
    const tdIdx = events.findIndex(e => e.type === 'tutor_delta')

    expect(ddIdx).toBeGreaterThanOrEqual(0)
    expect(tdIdx).toBeGreaterThanOrEqual(0)
    expect(ddIdx).toBeLessThan(tdIdx)
  })

  // §4: "done always emitted even when a Generator job fails"
  it('done event is emitted even when a Generator job throws an error', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)

    const root = await getRootNode(mapId)

    // Turn 2: Director calls expandMap — the generator job will fail (no generator-map queued)
    // The strict mock throws when generator-map queue is empty, simulating a Generator failure.
    // We enqueue an explicit failure signal for the generator-map role.
    await enqueueResponse({ role: 'reader', parsed: makeReaderOutput({ conversationNodeId: root.id }), usage: defaultUsage })
    await enqueueResponse(makeDirectorMock([
      { name: 'setTutorMode', input: { mode: 'explain' } },
      { name: 'expandMap', input: { nodeId: root.id, direction: 'deepen' } },
    ]))
    await enqueueResponse(makeTutorMock('The interesting part is...'))
    await enqueueResponse(makeSafetyMock())
    // Enqueue a generator-map response with the failure signal
    await enqueueResponse({
      role: 'generator-map',
      parsed: { __simulate_failure: true } as unknown as { nodes: [] },
      usage: defaultUsage,
    })

    const events = await collectTurnEvents(sessionId, 'Tell me more', { timeoutMs: 12_000 })

    // done must always be the last event
    expect(events[events.length - 1].type).toBe('done')
  })

  // §5 step 7 + §8: Generator exception → generation_failed Event logged
  it('generation_failed event is logged when a Generator job fails', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)

    const root = await getRootNode(mapId)

    await enqueueResponse({ role: 'reader', parsed: makeReaderOutput({ conversationNodeId: root.id }), usage: defaultUsage })
    await enqueueResponse(makeDirectorMock([
      { name: 'setTutorMode', input: { mode: 'explain' } },
      { name: 'expandMap', input: { nodeId: root.id, direction: 'deepen' } },
    ]))
    await enqueueResponse(makeTutorMock())
    await enqueueResponse(makeSafetyMock())
    await enqueueResponse({
      role: 'generator-map',
      parsed: { __simulate_failure: true } as unknown as { nodes: [] },
      usage: defaultUsage,
    })

    await collectTurnEvents(sessionId, 'Tell me more', { timeoutMs: 12_000 })

    // Brief wait for async generator job to finish
    await new Promise(r => setTimeout(r, 600))

    const failureEvents = await getSessionEvents(sessionId, 'generation_failed')
    expect(failureEvents.length).toBeGreaterThanOrEqual(1)
  })

  // §4: "map_update nodes carry hasOpenLoop: boolean"
  it('map_update node carries hasOpenLoop=true when the node has an open loop', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)

    const root = await getRootNode(mapId)
    const rootLoop = await getOpenLoopForNode(root.id)
    expect(rootLoop).not.toBeNull()

    // Turn 2: root is still current (open loop)
    const events = await doTurnN(sessionId, 'More please', makeReaderOutput({ conversationNodeId: root.id }))

    const mapUpdates = eventsOfType(events, 'map_update')
    expect(mapUpdates.length).toBeGreaterThanOrEqual(1)

    // Find the map_update that includes the root node
    const rootUpdate = mapUpdates
      .flatMap(e => (e.data as { nodes: Array<{ id: string; hasOpenLoop: boolean }> }).nodes)
      .find(n => n.id === root.id)

    if (rootUpdate) {
      expect(rootUpdate.hasOpenLoop).toBe(true)
    }
    // If root is not in this particular map_update (implementation may batch differently),
    // we check that any node with an open loop reports hasOpenLoop=true
    const allUpdateNodes = mapUpdates.flatMap(
      e => (e.data as { nodes: Array<{ id: string; hasOpenLoop: boolean }> }).nodes
    )
    for (const n of allUpdateNodes) {
      const loop = await prisma.loop.findFirst({ where: { nodeId: n.id, closedAt: null } })
      if (loop) {
        expect(n.hasOpenLoop).toBe(true)
      } else {
        expect(n.hasOpenLoop).toBe(false)
      }
    }
  })

  // §4: "upsert by id — so full snapshots and deltas are idempotent"
  // If the same node ID appears in multiple map_update events across turns,
  // the client should have only one node (by ID) after all updates are applied.
  // We test the server side: the same node must not be duplicated in the DB.
  it('same node sent in multiple map_update events does not create duplicate DB rows', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)

    const root = await getRootNode(mapId)

    // Turn 2
    const events2 = await doTurnN(sessionId, 'More please', makeReaderOutput({ conversationNodeId: root.id }))

    // Turn 3: same root node may appear again in map_update (e.g., proximity change)
    const events3 = await doTurnN(sessionId, 'And more', makeReaderOutput({ conversationNodeId: root.id }))

    // Verify: only ONE root node exists in the DB for this map
    const rootNodes = await prisma.mapNode.findMany({ where: { mapId, parentId: null } })
    expect(rootNodes.length).toBe(1)

    // Verify: only ONE loop exists for the root node
    const rootLoops = await prisma.loop.findMany({ where: { nodeId: root.id } })
    expect(rootLoops.length).toBe(1)
  })
})

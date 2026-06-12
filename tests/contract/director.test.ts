/**
 * Director validation and decision logging — §5 step 4, §6.2, §8 (DirectorDecision)
 * Tests: missing setTutorMode default, tool cap, decision row persistence, outcome backfill.
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
  endSession,
  getRootNode,
  getAllDirectorDecisions,
  getLatestDirectorDecision,
  getSessionEvents,
  makeReaderOutput,
  makeDirectorMock,
  makeTutorMock,
  makeSafetyMock,
  defaultUsage,
  eventsOfType,
} from './helpers.js'

beforeEach(async () => {
  await resetDB()
  await resetMocks()
})

describe('Director validation and logging — §5 step 4, §6.2, §8', () => {
  // §5 step 4: "if setTutorMode is missing, default setTutorMode('explain') and log a warning"
  it('Director output missing setTutorMode defaults the mode to explain', async () => {
    const { sessionId } = await onboardUser()

    // Director returns expandMap only — no setTutorMode
    await enqueueResponse({
      role: 'director',
      tools: [{ name: 'expandMap', input: { nodeId: 'root', direction: 'branch' } }],
      usage: defaultUsage,
    })
    await enqueueResponse(makeTutorMock())
    await enqueueResponse(makeSafetyMock())

    // Should succeed (explain is used as fallback)
    const events = await collectTurnEvents(sessionId, 'Hello')
    expect(eventsOfType(events, 'done').length).toBe(1)

    // DirectorDecision row's directive should contain 'explain' as the mode
    const decision = await getLatestDirectorDecision(sessionId)
    expect(decision).not.toBeNull()
    expect(decision!.directive).toContain('explain')
  })

  // §5 step 4: "if setTutorMode is missing ... log a warning"
  it('missing setTutorMode causes a warning event to be logged', async () => {
    const { sessionId } = await onboardUser()

    await enqueueResponse({
      role: 'director',
      tools: [{ name: 'raiseCaution', input: { note: 'be careful' } }],
      usage: defaultUsage,
    })
    await enqueueResponse(makeTutorMock())
    await enqueueResponse(makeSafetyMock())

    await collectTurnEvents(sessionId, 'Hello')

    // A warning must appear in the events table
    const events = await getSessionEvents(sessionId)
    const warnings = events.filter(e =>
      e.type === 'director_warning' ||
      (e.type === 'warning' && (e.payload as Record<string, unknown>).reason?.toString().includes('setTutorMode'))
    )
    expect(warnings.length).toBeGreaterThanOrEqual(1)
  })

  // §6.2: "max 2 tool calls/turn" — Director returning 3 tools is capped to 2
  it('Director output with 3 tool calls is capped to 2 dispatched calls', async () => {
    const { sessionId } = await onboardUser()

    await enqueueResponse({
      role: 'director',
      tools: [
        { name: 'setTutorMode', input: { mode: 'explain' } },
        { name: 'expandMap', input: { nodeId: 'root', direction: 'deepen' } },
        { name: 'spawnArtifact', input: { templateId: 'slider-sim', nodeId: 'root', loopQuestion: 'test' } },
      ],
      usage: defaultUsage,
    })
    await enqueueResponse(makeTutorMock())
    await enqueueResponse(makeSafetyMock())

    // Even with expandMap + spawnArtifact in the tools, only 2 total should be dispatched.
    // We enqueue one generator-map but NOT one generator-artifact to verify at most one
    // async job fires (meaning the third tool was dropped).
    await enqueueResponse({ role: 'generator-map', parsed: { nodes: [] }, usage: defaultUsage })

    const events = await collectTurnEvents(sessionId, 'Hello', { timeoutMs: 10_000 })
    expect(eventsOfType(events, 'done').length).toBe(1)

    // The decision row should record at most 2 tools
    const decision = await getLatestDirectorDecision(sessionId)
    expect(decision).not.toBeNull()
    const tools = decision!.tools as unknown[]
    expect(Array.isArray(tools)).toBe(true)
    expect((tools as unknown[]).length).toBeLessThanOrEqual(2)
  })

  // §8: "DirectorDecision row: signals, tools, rationale, directive persisted"
  it('DirectorDecision row is persisted with signals, tools, rationale, and directive', async () => {
    const { sessionId } = await onboardUser()

    await enqueueResponse(makeDirectorMock())
    await enqueueResponse(makeTutorMock())
    await enqueueResponse(makeSafetyMock())

    await collectTurnEvents(sessionId, 'Hello')

    const decision = await getLatestDirectorDecision(sessionId)
    expect(decision).not.toBeNull()
    expect(decision!.signals).not.toBeNull()
    expect(decision!.tools).not.toBeNull()
    expect(typeof decision!.rationale).toBe('string')
    expect(decision!.rationale.length).toBeGreaterThan(0)
    // rationale is ≤25 words (§7.2)
    const wordCount = decision!.rationale.trim().split(/\s+/).length
    expect(wordCount).toBeLessThanOrEqual(25)
    expect(typeof decision!.directive).toBe('string')
    expect(decision!.directive.length).toBeGreaterThan(0)
    expect(decision!.sessionId).toBe(sessionId)
  })

  // §5 step 3 + §8: "backfill outcome on the most recent null-outcome DirectorDecision of the session
  //                  where outcome IS NULL and turn < currentTurn"
  it('outcome is backfilled on the prior turn\'s DirectorDecision after the next turn completes', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)

    const root = await getRootNode(mapId)

    // Turn 2: fires Reader, Director, Tutor
    await doTurnN(sessionId, 'Turn 2', makeReaderOutput({ conversationNodeId: root.id }))

    // After turn 2, turn 1's DirectorDecision should have its outcome backfilled
    const decisions = await getAllDirectorDecisions(sessionId)
    expect(decisions.length).toBeGreaterThanOrEqual(2)

    const turn1Decision = decisions.find(d => d.turn === 1)
    expect(turn1Decision).not.toBeNull()
    // Turn 1's outcome must now be non-null (backfilled by the turn-2 Reader read)
    expect(turn1Decision!.outcome).not.toBeNull()

    // Turn 2's outcome stays null until turn 3
    const turn2Decision = decisions.find(d => d.turn === 2)
    expect(turn2Decision).not.toBeNull()
    expect(turn2Decision!.outcome).toBeNull()
  })

  // §8 + §16 acceptance item 8: "each session's final decision keeps outcome=null; that's expected"
  it('final turn\'s DirectorDecision outcome remains null (no subsequent turn to backfill it)', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)

    const root = await getRootNode(mapId)
    await doTurnN(sessionId, 'Turn 2', makeReaderOutput({ conversationNodeId: root.id }))

    // End the session — no more turns will happen
    await enqueueResponse({ role: 'profiler', parsed: {
      data: { modesThatLand: {}, pacing: 'moderate', styleNotes: [], clickPatterns: [], interests: [], vocabularyLevel: 'comfortable' },
      resumeSummary: 'Summary',
    }, usage: defaultUsage })

    await endSession(sessionId)

    const decisions = await getAllDirectorDecisions(sessionId)
    const lastDecision = decisions[decisions.length - 1]
    expect(lastDecision.outcome).toBeNull()
  })
})

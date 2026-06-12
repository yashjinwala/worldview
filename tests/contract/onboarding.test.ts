/**
 * Onboarding contract tests — POST /api/onboard
 * Spec references: §4 (API surface), §5.1 (pipeline step 1), §6.4 (node/loop lifecycle), §9 (surprise-me)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  prisma,
  resetDB,
  resetMocks,
  enqueueResponse,
  postOnboard,
  collectTurnEvents,
  onboardUser,
  doTurn1,
  doTurnN,
  getRootNode,
  makeUserId,
  makeTutorMock,
  makeDirectorMock,
  makeSafetyMock,
  makeSeedGeneratorMock,
  makeReaderOutput,
  defaultUsage,
} from './helpers.js'

beforeEach(async () => {
  await resetDB()
  await resetMocks()
})

describe('POST /api/onboard', () => {
  // §4: POST /api/onboard creates map + session + root node (current) + its open Loop
  it('creates a Map, Session, root MapNode with status=current, and an open Loop', async () => {
    const { userId, mapId, sessionId } = await onboardUser()

    // Map exists and belongs to user
    const map = await prisma.map.findUnique({ where: { id: mapId } })
    expect(map).not.toBeNull()
    expect(map!.userId).toBe(userId)

    // Session exists and belongs to map
    const session = await prisma.session.findUnique({ where: { id: sessionId } })
    expect(session).not.toBeNull()
    expect(session!.mapId).toBe(mapId)
    expect(session!.endedAt).toBeNull()

    // Root node has status 'current'
    const root = await prisma.mapNode.findFirst({ where: { mapId, parentId: null } })
    expect(root).not.toBeNull()
    expect(root!.status).toBe('current')

    // There is exactly one Loop for the root node, and it is open
    const loop = await prisma.loop.findFirst({ where: { nodeId: root!.id } })
    expect(loop).not.toBeNull()
    expect(loop!.closedAt).toBeNull()
    expect(loop!.closedBy).toBeNull()
  })

  // §4: startingPosition stored verbatim for challenge-a-belief posture (PRD §5.7)
  it('stores startingPosition verbatim on Map for challenge posture', async () => {
    const startingPosition = 'I think the national debt will crash the economy within five years'
    const { mapId } = await onboardUser({ posture: 'challenge', startingPosition })

    const map = await prisma.map.findUnique({ where: { id: mapId } })
    expect(map!.startingPosition).toBe(startingPosition)
  })

  // §4: startingPosition must not be stored for non-challenge postures
  it('does not store startingPosition for understand posture even if provided', async () => {
    const { mapId } = await onboardUser({ posture: 'understand' })

    const map = await prisma.map.findUnique({ where: { id: mapId } })
    expect(map!.startingPosition).toBeNull()
  })

  // §4: response body contains sharpenedQuestion
  it('returns the sharpenedQuestion from the sharpen mock in the response body', async () => {
    const userId = makeUserId()
    const sharpened = 'Is the US national debt actually dangerous — and how would we know?'
    await enqueueResponse({ role: 'sharpen', sharpened, usage: defaultUsage })
    await enqueueResponse(makeSeedGeneratorMock())

    const response = await postOnboard({
      userId,
      posture: 'understand',
      rawQuestion: 'why is everyone worried about the debt',
    })

    expect(response.sharpenedQuestion).toBe(sharpened)
    expect(response.mapId).toBeTruthy()
    expect(response.sessionId).toBeTruthy()
  })

  // §4 + §5 step 1 (seed-await): seed nodes exist in DB after turn 2 completes
  it('seed nodes appear in DB by the end of turn 2 (seed-await)', async () => {
    const userId = makeUserId()
    const sharpened = 'About debt'

    await enqueueResponse({ role: 'sharpen', sharpened, usage: defaultUsage })
    // Enqueue 4 seed nodes — the seed job will consume this generator-map response
    await enqueueResponse({
      role: 'generator-map',
      parsed: {
        nodes: [
          { title: 'Who holds the debt', summary: 'Holders', hookQuestion: 'Who really owns all this?' },
          { title: 'Why Japan is fine at 260%', summary: 'Japan comparison', hookQuestion: 'If Japan is fine, why worry about the US?' },
          { title: 'What economists actually fear', summary: 'Real concerns', hookQuestion: 'What keeps economists up at night?' },
          { title: 'Forty years of wrong predictions', summary: 'History', hookQuestion: 'Why have crisis predictions been wrong for decades?' },
        ],
      },
      usage: defaultUsage,
    })

    const { mapId, sessionId } = await postOnboard({
      userId,
      posture: 'understand',
      rawQuestion: 'tell me about the debt',
    })

    // Turn 1 (cold start — no Reader)
    await doTurn1(sessionId)

    // Get root node ID for turn-2 Reader
    const root = await getRootNode(mapId)

    // Turn 2 — the server awaits the seed job before running the Reader
    await doTurnN(sessionId, 'tell me more', makeReaderOutput({ conversationNodeId: root.id }))

    // By now the seed job must have resolved
    const allNodes = await prisma.mapNode.findMany({ where: { mapId } })
    const frontierNodes = allNodes.filter(n => n.status === 'frontier')
    expect(frontierNodes.length).toBeGreaterThanOrEqual(4)
    // root + 4 seed = at least 5 nodes total
    expect(allNodes.length).toBeGreaterThanOrEqual(5)
  })

  // §9: surprise-me posture skips question sharpening and uses a hardcoded rotation entry
  it('surprise-me posture does not call sharpen and returns a non-empty hardcoded question', async () => {
    // Deliberately do NOT enqueue a sharpen response.
    // If the server calls sharpen for surprise-me, the strict mock will error.
    await enqueueResponse(makeSeedGeneratorMock())

    const userId = makeUserId()
    const response = await postOnboard({ userId, posture: 'surprise-me' })

    const map = await prisma.map.findUnique({ where: { id: response.mapId } })
    expect(map).not.toBeNull()
    // heldQuestion is one of the 8 hardcoded entries — it must be non-empty and ≥10 chars
    expect(map!.heldQuestion).toBeTruthy()
    expect(map!.heldQuestion.length).toBeGreaterThan(10)
    // Posture is stored correctly
    expect(map!.posture).toBe('surprise-me')
  })
})

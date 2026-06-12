/**
 * positionShift, Loop.proximity, and lastTouchedAt — §5 step 3, §8 (Loop model)
 * Tests: positionShift written on held-belief close, not written on non-challenge maps,
 * proximity + lastTouchedAt stamped on each turn.
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
  getRootNode,
  getOpenLoopForNode,
  makeReaderOutput,
  defaultUsage,
} from './helpers.js'

beforeEach(async () => {
  await resetDB()
  await resetMocks()
})

describe('positionShift and proximity — §5 step 3, §8', () => {
  // §5 step 3: "write positionShift onto that Loop" (on close, on a held-belief map,
  //            when Reader returns a non-null positionShift)
  it('positionShift is written to the closed Loop when Reader provides it on a challenge-a-belief map', async () => {
    const startingPosition = 'I think the national debt is extremely dangerous and will cause collapse'
    const { mapId, sessionId } = await onboardUser({
      posture: 'challenge',
      startingPosition,
    })
    await doTurn1(sessionId)

    const root = await getRootNode(mapId)
    const rootLoop = await getOpenLoopForNode(root.id)
    expect(rootLoop).not.toBeNull()

    const shift = 'thought debt number was the danger → now thinks the interest rate relative to growth is the real risk'

    // Turn 2: Reader closes the loop and provides a positionShift
    await doTurnN(
      sessionId,
      'Oh I see — it\'s not the raw number, it\'s the rate. The rate sets the trajectory.',
      makeReaderOutput({
        conversationNodeId: root.id,
        justClosed: true,
        closedLoopId: rootLoop!.id,
        proximityToClose: 1.0,
        positionShift: shift,
      })
    )

    const closedLoop = await prisma.loop.findUnique({ where: { id: rootLoop!.id } })
    expect(closedLoop!.closedAt).not.toBeNull()
    expect(closedLoop!.positionShift).toBe(shift)
  })

  // §5 step 3: positionShift field in Reader output is non-null only "on a map with a stated
  //            startingPosition and the user's view visibly moved" — if map has no startingPosition,
  //            positionShift should NOT be written even if Reader provides it
  it('positionShift is not written to Loop when the map has no startingPosition', async () => {
    const { mapId, sessionId } = await onboardUser({ posture: 'understand' })
    // Map.startingPosition is null (understand posture)

    await doTurn1(sessionId)

    const root = await getRootNode(mapId)
    const rootLoop = await getOpenLoopForNode(root.id)
    expect(rootLoop).not.toBeNull()

    // Turn 2: Reader provides positionShift even though this is a non-challenge map
    await doTurnN(
      sessionId,
      'I get it now!',
      makeReaderOutput({
        conversationNodeId: root.id,
        justClosed: true,
        closedLoopId: rootLoop!.id,
        proximityToClose: 1.0,
        positionShift: 'thought X → now thinks Y',
      })
    )

    const closedLoop = await prisma.loop.findUnique({ where: { id: rootLoop!.id } })
    expect(closedLoop!.closedAt).not.toBeNull()
    // positionShift must be null (map has no startingPosition)
    expect(closedLoop!.positionShift).toBeNull()
  })

  // §5 step 3: "Write proximityToClose to the active Loop's proximity and stamp Loop.lastTouchedAt"
  it('Loop.proximity is updated and lastTouchedAt is stamped whenever Reader reports proximityToClose', async () => {
    const { mapId, sessionId } = await onboardUser()
    await doTurn1(sessionId)

    const root = await getRootNode(mapId)
    const loop = await getOpenLoopForNode(root.id)
    expect(loop).not.toBeNull()

    const proximityBefore = loop!.proximity
    const lastTouchedBefore = loop!.lastTouchedAt

    // Small delay to ensure createdAt/lastTouchedAt differ
    await new Promise(r => setTimeout(r, 20))

    // Turn 2: Reader reports proximityToClose=0.7
    await doTurnN(
      sessionId,
      'I think I\'m starting to see it',
      makeReaderOutput({ conversationNodeId: root.id, proximityToClose: 0.7 })
    )

    const updatedLoop = await prisma.loop.findUnique({ where: { id: loop!.id } })
    expect(updatedLoop!.proximity).toBe(0.7)
    expect(updatedLoop!.lastTouchedAt).not.toBeNull()

    // If there was a prior lastTouchedAt, the new one should be >= the old one
    if (lastTouchedBefore) {
      expect(new Date(updatedLoop!.lastTouchedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(lastTouchedBefore).getTime()
      )
    }
  })
})

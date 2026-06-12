import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserModelData } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/maps?userId= — the shelf. One card per map: held question, glowing-loop
// count, the brightest open loop named outright, "Where you stand", last-visited.
// After the 3rd session, a card gains one "your guide has noticed" styleNote (§9).
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const [maps, userModel, sessionCount, latestSession] = await Promise.all([
    prisma.map.findMany({ where: { userId }, orderBy: { lastVisitedAt: 'desc' } }),
    prisma.userModel.findUnique({ where: { userId } }),
    prisma.session.count({ where: { userId } }),
    prisma.session.findFirst({ where: { userId }, orderBy: { startedAt: 'desc' } }),
  ])

  const styleNote =
    sessionCount >= 3 ? ((userModel?.data as UserModelData | undefined)?.styleNotes?.[0] ?? null) : null

  const cards = await Promise.all(
    maps.map(async (m) => {
      const openLoops = await prisma.loop.findMany({
        where: { mapId: m.id, closedAt: null },
        orderBy: { proximity: 'desc' },
      })
      return {
        mapId: m.id,
        heldQuestion: m.heldQuestion,
        posture: m.posture,
        openLoopCount: openLoops.length,
        brightestOpenLoop: openLoops[0]?.question ?? null,
        currentView: m.currentView,
        startingPosition: m.startingPosition,
        lastVisitedAt: m.lastVisitedAt,
        // The most recent session id on this map — the client POSTs a turn to it to
        // resume (the server creates a return session lazily, §5).
      }
    })
  )

  return NextResponse.json({
    maps: cards,
    sessionCount,
    styleNote,
    latestSessionId: latestSession?.id ?? null,
  })
}

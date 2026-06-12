import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/export?userId= — round-trips all of a user's data as one JSON file
// (TDD §9: "your maps are keyed to this browser's anonymous ID; export to keep a copy").
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  const [userModel, maps, sessions] = await Promise.all([
    prisma.userModel.findUnique({ where: { userId } }),
    prisma.map.findMany({ where: { userId } }),
    prisma.session.findMany({ where: { userId } }),
  ])
  const mapIds = maps.map((m) => m.id)
  const sessionIds = sessions.map((s) => s.id)
  const [nodes, loops, viewSnapshots, messages, decisions, artifacts, events] = await Promise.all([
    prisma.mapNode.findMany({ where: { mapId: { in: mapIds } } }),
    prisma.loop.findMany({ where: { mapId: { in: mapIds } } }),
    prisma.viewSnapshot.findMany({ where: { mapId: { in: mapIds } } }),
    prisma.message.findMany({ where: { sessionId: { in: sessionIds } } }),
    prisma.directorDecision.findMany({ where: { sessionId: { in: sessionIds } } }),
    prisma.artifact.findMany({ where: { sessionId: { in: sessionIds } } }),
    prisma.event.findMany({ where: { sessionId: { in: sessionIds } } }),
  ])

  return NextResponse.json(
    { version: 1, exportedAt: new Date().toISOString(), user, userModel, maps, sessions, nodes, loops, viewSnapshots, messages, decisions, artifacts, events },
    { headers: { 'Content-Disposition': `attachment; filename="worldview-${userId}.json"` } }
  )
}

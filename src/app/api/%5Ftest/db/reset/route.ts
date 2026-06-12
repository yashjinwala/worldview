import { NextResponse } from 'next/server'
import { isMockMode } from '@/lib/mockStore'
import { prisma } from '@/lib/prisma'
import { resetSessionState } from '@/lib/sessionState'

export const dynamic = 'force-dynamic'

// POST /api/_test/db/reset — FK-safe truncate of all tables (tests/README order).
export async function POST() {
  if (!isMockMode()) return new NextResponse(null, { status: 404 })
  // Order: Events → Artifacts → DirectorDecision → Message → Loop → ViewSnapshot
  //        → MapNode → Session → Map → UserModel → User
  await prisma.$transaction([
    prisma.event.deleteMany(),
    prisma.artifact.deleteMany(),
    prisma.directorDecision.deleteMany(),
    prisma.message.deleteMany(),
    prisma.loop.deleteMany(),
    prisma.viewSnapshot.deleteMany(),
    prisma.mapNode.deleteMany(),
    prisma.session.deleteMany(),
    prisma.map.deleteMany(),
    prisma.userModel.deleteMany(),
    prisma.user.deleteMany(),
  ])
  // Clear in-memory per-session state so it can't leak across tests.
  resetSessionState()
  return NextResponse.json({ ok: true })
}

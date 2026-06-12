import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveSession, buildTurnStream, TurnError } from '@/lib/pipeline'
import { SSE_HEADERS } from '@/lib/sse'
import { GLOBAL_DAILY_LIMIT_USD } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

// POST /api/turn — SSE stream of one turn (§4/§5). One pipeline in flight per session.
export async function POST(req: NextRequest) {
  let body: { sessionId?: string; message?: string; viaShelf?: boolean; viaNodeClick?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (!body.sessionId || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'sessionId and message required' }, { status: 400 })
  }

  // Global daily spend cap (G-19) — checked at turn start, before any model call and
  // before the per-session ceiling branch.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const agg = await prisma.session.aggregate({ _sum: { costUsd: true }, where: { startedAt: { gte: since } } })
  if ((agg._sum.costUsd ?? 0) >= GLOBAL_DAILY_LIMIT_USD) {
    return new NextResponse(
      'Worldview is resting — back tomorrow. (The daily spend cap for this instance has been reached.)',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    )
  }

  let resolved
  try {
    resolved = await resolveSession(body.sessionId, body.viaShelf)
  } catch (e) {
    if (e instanceof TurnError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }

  const stream = buildTurnStream(resolved, body.message, body.viaNodeClick === true)
  return new NextResponse(stream, { headers: SSE_HEADERS })
}

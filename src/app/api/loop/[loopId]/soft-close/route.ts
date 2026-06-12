import { NextRequest, NextResponse } from 'next/server'
import { softClose, TurnError } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

// POST /api/loop/[loopId]/soft-close — user closes a stale loop from the node context
// menu ("I've settled this elsewhere"). closedBy="user"; never chains (§6.4, G-03).
export async function POST(req: NextRequest, ctx: { params: Promise<{ loopId: string }> }) {
  const { loopId } = await ctx.params
  let body: { sessionId?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  if (!body.sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  try {
    const result = await softClose(loopId, body.sessionId)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof TurnError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { logEvent } from '@/lib/events'

export const dynamic = 'force-dynamic'

// POST /api/event — client-logged events: reader_disputed (Conductor 👍/👎) and
// mobile_gate (TDD §9, §12).
export async function POST(req: NextRequest) {
  let body: { sessionId?: string; type?: string; payload?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (!body.sessionId || !body.type) return NextResponse.json({ error: 'sessionId and type required' }, { status: 400 })
  await logEvent(body.sessionId, body.type, body.payload ?? {})
  return NextResponse.json({ ok: true })
}

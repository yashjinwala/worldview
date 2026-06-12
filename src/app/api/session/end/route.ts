import { NextRequest, NextResponse } from 'next/server'
import { endSessionPipeline } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

// POST /api/session/end — Profiler + metrics rollup (§4, §5 step 8). Also fired via
// navigator.sendBeacon on tab close. Response shape per G-12.
export async function POST(req: NextRequest) {
  let body: { sessionId?: string }
  try {
    body = await req.json()
  } catch {
    // sendBeacon may send a blob; tolerate empty/non-JSON bodies.
    body = {}
  }
  if (!body.sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const metrics = await endSessionPipeline(body.sessionId)
  if (!metrics) return NextResponse.json({ error: 'session not found' }, { status: 404 })
  return NextResponse.json(metrics)
}

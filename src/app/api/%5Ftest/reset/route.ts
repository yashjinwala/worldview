import { NextResponse } from 'next/server'
import { isMockMode, mockReset } from '@/lib/mockStore'

export const dynamic = 'force-dynamic'

// POST /api/_test/reset — clear all mock queues. Does not touch the DB.
export async function POST() {
  if (!isMockMode()) return new NextResponse(null, { status: 404 })
  mockReset()
  return NextResponse.json({ ok: true })
}

// The test harness also probes this route with GET to detect server readiness.
export async function GET() {
  if (!isMockMode()) return new NextResponse(null, { status: 404 })
  return NextResponse.json({ ok: true })
}

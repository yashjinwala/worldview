import { NextRequest, NextResponse } from 'next/server'
import { isMockMode, mockEnqueue, LLM_ROLES } from '@/lib/mockStore'

export const dynamic = 'force-dynamic'

// POST /api/_test/enqueue — enqueue a scripted response for the next call to a role.
// Mounted only under LLM_MODE=mock (G-15: plain 404 otherwise).
export async function POST(req: NextRequest) {
  if (!isMockMode()) return new NextResponse(null, { status: 404 })
  let body: { role?: string } & Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const role = body.role
  if (!role || !LLM_ROLES.includes(role as never)) {
    return NextResponse.json({ error: `unknown role: ${role}` }, { status: 400 })
  }
  // Store the whole body verbatim; the LLM module reads the role-specific fields.
  mockEnqueue(role, body)
  return NextResponse.json({ ok: true })
}

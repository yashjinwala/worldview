import { NextRequest, NextResponse } from 'next/server'
import { onboard } from '@/lib/pipeline'
import { Posture } from '@/lib/types'

export const dynamic = 'force-dynamic'

const POSTURES: Posture[] = ['understand', 'challenge', 'deep-dive', 'surprise-me']

// POST /api/onboard — sharpens the question, creates map + session + root node/loop,
// kicks off seed generation (§4).
export async function POST(req: NextRequest) {
  let body: { userId?: string; posture?: string; rawQuestion?: string; startingPosition?: string; deviceClass?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (!body.userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (!body.posture || !POSTURES.includes(body.posture as Posture)) {
    return NextResponse.json({ error: `invalid posture: ${body.posture}` }, { status: 400 })
  }

  const result = await onboard({
    userId: body.userId,
    posture: body.posture as Posture,
    rawQuestion: body.rawQuestion,
    startingPosition: body.startingPosition,
    deviceClass: body.deviceClass,
  })
  return NextResponse.json(result)
}

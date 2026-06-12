import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/map/[mapId]/view — the ✎ edit on "Where you stand". Typing a replacement
// updates Map.currentView and writes a new dated ViewSnapshot (TDD §5.7, §9).
export async function POST(req: NextRequest, ctx: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await ctx.params
  let body: { content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const content = (body.content ?? '').trim()
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const map = await prisma.map.findUnique({ where: { id: mapId } })
  if (!map) return NextResponse.json({ error: 'map not found' }, { status: 404 })

  await prisma.map.update({ where: { id: mapId }, data: { currentView: content } })
  const snapshot = await prisma.viewSnapshot.create({ data: { mapId, content } })
  return NextResponse.json({ ok: true, snapshot })
}

import { NextRequest, NextResponse } from 'next/server'
import { buildMapSnapshot } from '@/lib/pipeline'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/map/[mapId] — full snapshot (nodes, loops, artifacts, view snapshots).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await ctx.params
  const snapshot = await buildMapSnapshot(mapId)
  if (!snapshot) return NextResponse.json({ error: 'map not found' }, { status: 404 })
  return NextResponse.json(snapshot)
}

// POST /api/map/[mapId] — retitle the held question. The editable sharpen-confirm's
// "final text is what's stored" (§4): updates heldQuestion + the root node + its loop.
export async function POST(req: NextRequest, ctx: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await ctx.params
  let body: { heldQuestion?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const q = (body.heldQuestion ?? '').trim()
  if (!q) return NextResponse.json({ error: 'heldQuestion required' }, { status: 400 })

  await prisma.map.update({ where: { id: mapId }, data: { heldQuestion: q, title: q } })
  const root = await prisma.mapNode.findFirst({ where: { mapId, parentId: null } })
  if (root) {
    await prisma.mapNode.update({ where: { id: root.id }, data: { title: q, summary: q, hookQuestion: q } })
    await prisma.loop.updateMany({ where: { nodeId: root.id, closedAt: null }, data: { question: q } })
  }
  return NextResponse.json({ ok: true })
}

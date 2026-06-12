import { NextRequest, NextResponse } from 'next/server'
import { buildMapSnapshot } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

// GET /api/map/[mapId] — full snapshot (nodes, loops, artifacts, view snapshots).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await ctx.params
  const snapshot = await buildMapSnapshot(mapId)
  if (!snapshot) return NextResponse.json({ error: 'map not found' }, { status: 404 })
  return NextResponse.json(snapshot)
}

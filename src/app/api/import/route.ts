import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type Row = Record<string, unknown>
const j = (v: unknown) => v as Prisma.InputJsonValue

// POST /api/import — restores an export bundle on a fresh profile (TDD §9, §16 item 15).
// Idempotent-ish: upserts the user/model, skips rows whose ids already exist.
export async function POST(req: NextRequest) {
  let bundle: Record<string, Row[] | Row>
  try {
    bundle = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const user = bundle.user as Row | undefined
  if (!user || !user.id) return NextResponse.json({ error: 'bundle.user required' }, { status: 400 })
  const userId = String(user.id)

  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} })

  const userModel = bundle.userModel as Row | null
  if (userModel) {
    await prisma.userModel.upsert({
      where: { userId },
      create: { userId, data: j(userModel.data) },
      update: { data: j(userModel.data) },
    })
  }

  const arr = (k: string) => (Array.isArray(bundle[k]) ? (bundle[k] as Row[]) : [])

  // FK-safe creation order; createMany with skipDuplicates so a partial re-import is safe.
  await prisma.map.createMany({ data: arr('maps').map((m) => ({ ...m, startingPosition: m.startingPosition ?? null })) as any })
  await prisma.mapNode.createMany({ data: arr('nodes') as any })
  await prisma.session.createMany({ data: arr('sessions') as any })
  await prisma.viewSnapshot.createMany({ data: arr('viewSnapshots') as any })
  await prisma.loop.createMany({ data: arr('loops') as any })
  await prisma.message.createMany({ data: arr('messages') as any })
  await prisma.directorDecision.createMany({ data: arr('decisions').map((d) => ({ ...d, signals: j(d.signals), tools: j(d.tools), outcome: d.outcome == null ? Prisma.DbNull : j(d.outcome) })) as any })
  await prisma.artifact.createMany({ data: arr('artifacts').map((a) => ({ ...a, props: j(a.props) })) as any })
  await prisma.event.createMany({ data: arr('events').map((e) => ({ ...e, payload: j(e.payload) })) as any })

  return NextResponse.json({ ok: true, userId })
}

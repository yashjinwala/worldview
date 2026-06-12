// /stats — the v1 eval instrument (TDD §12, §16 items 6 & 8). No dashboards: a plain
// page listing sessions with the four numbers, the persisted user model, the decision
// log (signals/tools/rationale/directive/outcome), organic chains, and Reader disputes.

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function StatsPage() {
  const [sessions, userModels, decisions, disputes, chains] = await Promise.all([
    prisma.session.findMany({ orderBy: { startedAt: 'desc' }, take: 50, include: { map: true } }),
    prisma.userModel.findMany({ orderBy: { updatedAt: 'desc' } }),
    prisma.directorDecision.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
    prisma.event.findMany({ where: { type: 'reader_disputed' }, orderBy: { createdAt: 'desc' }, take: 40 }),
    prisma.loop.findMany({ where: { NOT: { chainedFromLoopId: null } } }),
  ])

  // Organic chains (§12, G-21): chains whose chained loop was NOT opened by a Director branch.
  const organic = chains.filter((c) => c.openedBy !== 'director_branch')

  return (
    <div className="wv-stats">
      <h1>Worldview · /stats</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
        The v1 eval instrument. North star is read qualitatively here, not as dashboards.
      </p>

      <h2>Sessions ({sessions.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Started</th><th>Map</th><th>Loops closed</th><th>Chained</th><th>Dangling</th>
            <th>Active s</th><th>Cost $</th><th>Synth</th><th>Locked</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>{new Date(s.startedAt).toLocaleString()}</td>
              <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.map?.heldQuestion}</td>
              <td>{s.loopsClosed}</td>
              <td>{s.loopsChained}</td>
              <td>{s.loopsDangling}</td>
              <td>{s.activeSeconds}</td>
              <td>{s.costUsd.toFixed(4)}</td>
              <td>{s.synthesisFired ? '✓' : ''}</td>
              <td>{s.costLocked ? '🔒' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Organic chain rate (§12, G-21)</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
        {organic.length} of {chains.length} chains were not Director-initiated branches —
        the chain rate read net of the system’s own moves.
      </p>

      <h2>User models (the moat)</h2>
      {userModels.length === 0 && <p style={{ color: 'var(--color-text-muted)' }}>No user models yet.</p>}
      {userModels.map((m) => (
        <div key={m.userId} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            {m.userId} · updated {new Date(m.updatedAt).toLocaleString()}
          </div>
          <pre>{JSON.stringify(m.data, null, 2)}</pre>
        </div>
      ))}

      <h2>Director decisions (training set) — latest 40</h2>
      <table>
        <thead>
          <tr><th>Turn</th><th>Rationale</th><th>Tools</th><th>Outcome backfilled?</th></tr>
        </thead>
        <tbody>
          {decisions.map((d) => (
            <tr key={d.id}>
              <td>{d.turn}</td>
              <td style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>{d.rationale}</td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-code)' }}>
                {Array.isArray(d.tools) ? (d.tools as Array<{ name: string }>).map((t) => t.name).join(' + ') : ''}
              </td>
              <td>{d.outcome ? '✓' : '— (final turn)'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Reader disputes (eval candidates) — {disputes.length}</h2>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        The Conductor 👍/👎 collects candidates for the post-build hand-label pass (Reader
        agreement reported in the README, PRD §10).
      </p>
    </div>
  )
}

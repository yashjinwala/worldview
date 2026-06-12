'use client'
// The Conductor pane (TDD §9). The orchestration, visible: one row per turn with the
// signals the Director read, the move it made, its rationale, and a 👍/👎 — "did the
// guide read you right?" — that doubles as the Reader eval instrument (PRD §10).

import { useState } from 'react'

export interface ConductorRow {
  turn: number
  decisionId?: string
  signals: {
    appetite?: string | null
    proximityToClose?: number | null
    justClosed?: boolean
    isColdStart?: boolean
    isReturnTurn1?: boolean
  }
  tools: Array<{ name: string; input?: Record<string, unknown> }>
  rationale: string
}

function chips(s: ConductorRow['signals']) {
  const out: Array<{ cls: string; label: string }> = []
  if (s.isColdStart) out.push({ cls: 'chip-cold', label: 'cold start' })
  if (s.isReturnTurn1) out.push({ cls: 'chip-cold', label: 'welcome back' })
  if (s.appetite === 'leaning_in') out.push({ cls: 'chip-lean', label: 'leaning in' })
  else if (s.appetite === 'restless') out.push({ cls: 'chip-far', label: 'restless' })
  else if (s.appetite === 'neutral') out.push({ cls: 'chip-far', label: 'neutral' })
  if (typeof s.proximityToClose === 'number') {
    const near = s.proximityToClose >= 0.6
    out.push({
      cls: near ? 'chip-near' : 'chip-far',
      label: `${near ? 'near' : 'far from'} click · ${s.proximityToClose.toFixed(2)}`,
    })
  }
  return out
}

function toolStr(tools: ConductorRow['tools']): string {
  return tools
    .map((t) => {
      if (t.name === 'setTutorMode') return `setTutorMode(${t.input?.mode ?? ''})`
      if (t.name === 'expandMap') return `expandMap(${t.input?.direction ?? ''})`
      if (t.name === 'spawnArtifact') return `spawnArtifact(${t.input?.templateId ?? ''})`
      if (t.name === 'raiseCaution') return 'raiseCaution()'
      return t.name
    })
    .join(' + ')
}

export default function ConductorPane({
  rows,
  stats,
  onDispute,
  collapsed,
  onToggleCollapse,
}: {
  rows: ConductorRow[]
  stats: { open: number; closed: number; dangling: number; cost: number }
  onDispute: (decisionId: string, vote: 'up' | 'down') => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const [votes, setVotes] = useState<Record<string, 'up' | 'down'>>({})

  return (
    <div className={`conductor-pane${collapsed ? ' collapsed' : ''}`}>
      <div className="cond-header">
        <span className="cond-title">How the guide is adapting to you this session</span>
        <button className="cond-collapse" onClick={onToggleCollapse}>
          {collapsed ? '↑ expand' : '↓ collapse'}
        </button>
      </div>
      <div className="cond-rows">
        {rows.length === 0 && (
          <div style={{ padding: '10px 0', fontSize: 11.5, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
            The Director&rsquo;s reads appear here, one row per turn.
          </div>
        )}
        {rows.map((r, i) => (
          <div className="cond-row" key={i}>
            <span className="cond-turn">Turn {r.turn}</span>
            <div className="cond-row-body">
              <div className="cond-chips">
                {chips(r.signals).map((c, j) => (
                  <span key={j} className={`chip ${c.cls}`}>{c.label}</span>
                ))}
              </div>
              <div className="cond-tools">{toolStr(r.tools)}</div>
              <div className="cond-rationale">&ldquo;{r.rationale}&rdquo;</div>
              {r.decisionId && (
                <div className="cond-thumbs" title="Did the guide read you right?">
                  <button
                    className={`cond-thumb${votes[r.decisionId] === 'up' ? ' active' : ''}`}
                    onClick={() => {
                      setVotes((v) => ({ ...v, [r.decisionId!]: 'up' }))
                      onDispute(r.decisionId!, 'up')
                    }}
                  >
                    👍
                  </button>
                  <button
                    className={`cond-thumb${votes[r.decisionId] === 'down' ? ' active' : ''}`}
                    onClick={() => {
                      setVotes((v) => ({ ...v, [r.decisionId!]: 'down' }))
                      onDispute(r.decisionId!, 'down')
                    }}
                  >
                    👎
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="cond-footer">
        <span className="footer-pip" style={{ background: 'var(--color-ember)' }} />
        {stats.open} loops open
        <span className="sep">·</span>
        <span className="footer-pip" style={{ background: 'var(--color-node-settled)' }} />
        {stats.closed} closed
        <span className="sep">·</span>
        {stats.dangling} dangling
        <span className="sep">·</span>${stats.cost.toFixed(2)}
      </div>
    </div>
  )
}

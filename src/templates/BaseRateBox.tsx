'use client'

import { useMemo, useState } from 'react'
import { BaseRateBoxProps } from './schemas'

// base-rate-box (TDD §10) — the base-rate confrontation. A proportional icon
// array makes the four-cell contingency visible; the user commits a guess for
// the positive predictive value, then the array highlights the actual fraction.

type Group = 'tp' | 'fp' | 'fn' | 'tn'

const COARSE_RANGES = ['0–10%', '10–30%', '30–50%', '50–70%', '70–100%']
const MAX_ICONS = 400
const ICON = 11
const GAP = 3

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function fmtPct(frac: number): string {
  const pct = frac * 100
  if (!Number.isFinite(pct)) return '—'
  return pct < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`
}

export function BaseRateBox({ props }: { props: BaseRateBoxProps }) {
  const { scenario, populationLabel, cells, question, intuitiveMisread, insight } = props

  const [value, setValue] = useState('')
  const [range, setRange] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Quadrant metadata. Order = flagged group first (tp + fp adjacent) so the
  // posterior reads as a clean green-within-positives sub-block in the array.
  const segments: { key: Group; color: string; cell: { count: number; label: string } }[] = [
    { key: 'tp', color: 'var(--icon-true-positive)', cell: cells.truePositive },
    { key: 'fp', color: 'var(--icon-false-positive)', cell: cells.falsePositive },
    { key: 'fn', color: 'var(--icon-false-negative)', cell: cells.falseNegative },
    { key: 'tn', color: 'var(--icon-true-negative)', cell: cells.trueNegative },
  ]

  const total = segments.reduce((a, s) => a + s.cell.count, 0)
  const flagged = cells.truePositive.count + cells.falsePositive.count
  const posterior = flagged === 0 ? 0 : cells.truePositive.count / flagged
  const scale = total > MAX_ICONS ? total / MAX_ICONS : 1

  const icons = useMemo(() => {
    const out: { color: string; group: Group }[] = []
    for (const s of segments) {
      const n = s.cell.count === 0 ? 0 : Math.max(1, Math.round(s.cell.count / scale))
      for (let i = 0; i < n; i++) out.push({ color: s.color, group: s.key })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, scale])

  const cols = Math.min(26, Math.max(6, Math.ceil(Math.sqrt(icons.length * 1.6))))
  const numeric = value.trim() === '' ? null : Math.max(0, Math.min(100, parseFloat(value)))
  const validNumeric = numeric !== null && !Number.isNaN(numeric)
  const canSubmit = validNumeric || range !== null
  const guessLabel = validNumeric ? `${numeric}%` : range ?? '—'

  function submit() {
    if (canSubmit) setSubmitted(true)
  }
  function pickRange(r: string) {
    setRange(r)
    setValue('')
    setSubmitted(true)
  }

  function iconOpacity(group: Group): number {
    if (!submitted) return 1
    return group === 'tp' || group === 'fp' ? 1 : 0.14
  }

  const label: React.CSSProperties = {
    display: 'block', fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
    letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-ember-dim)',
  }

  return (
    <div style={{ fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* scenario + population */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ ...label, color: 'var(--color-text-muted)' }}>{populationLabel} · {fmt(total)} total</span>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-primary)' }}>{scenario}</p>
      </div>

      {/* icon array */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${ICON}px)`, gap: GAP }}>
          {icons.map((ic, i) => (
            <div key={i} style={{
              width: ICON, height: ICON, borderRadius: 2, background: ic.color,
              opacity: iconOpacity(ic.group),
              boxShadow: submitted && ic.group === 'tp' ? '0 0 0 1px rgba(228,218,206,0.45)' : 'none',
              transition: 'opacity 300ms var(--ease-spring), box-shadow 300ms var(--ease-spring)',
            }} />
          ))}
        </div>
        {scale > 1 && (
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>each square ≈ {fmt(Math.round(scale))} {populationLabel.toLowerCase()}</span>
        )}
        {/* legend */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '6px 16px', marginTop: 2 }}>
          {segments.map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.cell.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{fmt(s.cell.count)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* question + guess */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.35, letterSpacing: '-0.015em', color: 'var(--color-text-primary)' }}>
          {question}
        </p>
        {!submitted && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number" inputMode="numeric" min={0} max={100} value={value} placeholder="Your estimate"
                onChange={(e) => { setValue(e.target.value); setRange(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                style={{
                  flex: 1, minWidth: 0, padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 14,
                  color: 'var(--color-text-primary)', background: 'var(--color-s2)',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', outline: 'none',
                }}
              />
              <button onClick={submit} disabled={!canSubmit} style={{
                padding: '10px 18px', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
                color: canSubmit ? 'var(--color-ground)' : 'var(--color-text-muted)',
                background: canSubmit ? 'var(--color-ember)' : 'var(--color-s3)',
                border: 'none', borderRadius: 'var(--radius-md)', cursor: canSubmit ? 'pointer' : 'default',
                transition: 'background 140ms ease',
              }}>Reveal</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COARSE_RANGES.map((r) => (
                <button key={r} onClick={() => pickRange(r)} style={{
                  padding: '6px 12px', fontFamily: 'var(--font-sans)', fontSize: 12,
                  color: 'var(--color-text-secondary)', background: 'var(--color-s2)',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                  transition: 'border-color 140ms ease, color 140ms ease',
                }}>{r}</button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* reveal */}
      {submitted && (
        <div style={{
          animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both',
          display: 'flex', flexDirection: 'column', gap: 14, padding: 16,
          background: 'var(--color-s2)', border: '1px solid var(--color-border-sub)', borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <span style={label}>Actual probability</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--color-ember)', lineHeight: 1.1 }}>
                {fmtPct(posterior)}
              </span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'right' }}>
              you guessed {guessLabel}<br />{fmt(cells.truePositive.count)} of {fmt(flagged)} flagged
            </span>
          </div>
          <div>
            <span style={{ ...label, marginBottom: 4 }}>Most people read it as</span>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>{intuitiveMisread}</p>
          </div>
          <div>
            <span style={{ ...label, marginBottom: 4 }}>The real picture</span>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-primary)' }}>{insight}</p>
          </div>
        </div>
      )}
    </div>
  )
}

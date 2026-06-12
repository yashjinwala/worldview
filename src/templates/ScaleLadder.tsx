'use client'

import { useState, useMemo } from 'react'
import { ScaleLadderProps } from './schemas'

type Bar = { id: string; kind: 'subject' | 'rung'; label: string; value: number; emoji?: string }

const log10 = (x: number) => Math.log(x) / Math.LN10

// Compact magnitude string: 33e12 → "33T", 4.54e2 → "454", 3.4e3 → "3.4K".
function compact(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const tiers: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]
  for (const [v, s] of tiers) {
    if (abs >= v) {
      const x = abs / v
      const str = x >= 100 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, '')
      return sign + str + s
    }
  }
  return sign + (abs >= 10 ? String(Math.round(abs)) : String(Math.round(abs * 10) / 10))
}

// Attach the subject's unit on the readable side ("$" prefixes, words suffix).
function withUnit(n: number, unit: string): string {
  const mag = compact(n)
  return /^[$€£¥₹]/.test(unit) ? `${unit}${mag}` : `${mag}${unit ? ` ${unit}` : ''}`
}

function ratioStr(r: number): string {
  if (r >= 10) return String(Math.round(r))
  return (Math.round(r * 10) / 10).toFixed(1).replace(/\.0$/, '')
}

export function ScaleLadder({ props }: { props: ScaleLadderProps }) {
  const { subject, rungs } = props
  const [selected, setSelected] = useState<string | null>(null)

  const { bars, useLog, minV, maxV } = useMemo(() => {
    const items: Bar[] = [
      { id: 'subject', kind: 'subject', label: subject.label, value: subject.value },
      ...rungs.map((r, i) => ({ id: `r${i}`, kind: 'rung' as const, label: r.label, value: r.value, emoji: r.emoji })),
    ]
    const vals = items.map((b) => b.value)
    const hi = Math.max(...vals)
    const lo = Math.min(...vals)
    // Span > 3 orders of magnitude → switch bar widths to a log10 scale.
    const log = lo > 0 && hi / lo > 1000
    items.sort((a, b) => b.value - a.value)
    return { bars: items, useLog: log, minV: lo, maxV: hi }
  }, [subject, rungs])

  // Bar fill fraction 0..1. Log mode floors the smallest at 6% so it stays visible.
  const frac = (v: number): number => {
    if (useLog) {
      const lmin = log10(minV)
      const lmax = log10(maxV)
      const t = lmax === lmin ? 1 : (log10(v) - lmin) / (lmax - lmin)
      return 0.06 + Math.max(0, t) * 0.94
    }
    return Math.max(maxV > 0 ? v / maxV : 0, 0.02)
  }

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {/* hero callout — the measured quantity, in display type */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase',
            color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 6,
          }}
        >
          {subject.label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 500,
            color: 'var(--color-ember)', lineHeight: 1, letterSpacing: '-0.02em',
          }}
        >
          {withUnit(subject.value, subject.unit)}
        </div>
      </div>

      {/* ladder — subject + each rung, sorted largest-first, widths proportional */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {bars.map((b) => {
          const isSubject = b.kind === 'subject'
          const isSel = selected === b.id

          let ratio: string | null = null
          if (!isSubject) {
            const big = Math.max(subject.value, b.value)
            const small = Math.min(subject.value, b.value)
            const r = small > 0 ? big / small : 0
            const ref = subject.value >= b.value ? b.label : subject.label
            ratio = r > 0 ? `${ratioStr(r)}× ${ref}` : null
          }

          return (
            <button
              key={b.id}
              onClick={() => setSelected(isSel ? null : b.id)}
              style={{
                background: isSel ? 'var(--color-s2)' : 'transparent',
                border: 'none', borderRadius: 'var(--radius-md)', padding: 8,
                width: '100%', textAlign: 'left', cursor: 'pointer',
                font: 'inherit', color: 'inherit', display: 'block',
                transition: 'background 0.2s var(--ease-default)',
              }}
            >
              {/* label (+emoji) left · ratio right */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
                <span
                  style={{
                    fontSize: 12, lineHeight: 1.35,
                    color: isSubject ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    fontWeight: isSubject ? 500 : 400,
                  }}
                >
                  {b.emoji ? `${b.emoji} ` : ''}{b.label}
                </span>
                <span
                  style={{
                    fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {isSubject ? (useLog ? 'log scale' : '') : ratio}
                </span>
              </div>

              {/* bar track + fill */}
              <div style={{ height: 7, background: 'var(--color-s4)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${frac(b.value) * 100}%`, height: '100%', borderRadius: 4,
                    background: isSubject ? 'var(--color-ember)' : 'var(--color-node-visited)',
                    opacity: isSubject ? 1 : 0.65,
                    boxShadow: isSubject ? '0 0 8px var(--color-ember-glow)' : 'none',
                    transition: 'width 0.28s var(--ease-default)',
                  }}
                />
              </div>

              {/* tap-to-reveal detail */}
              {isSel && (
                <div
                  style={{
                    marginTop: 8, fontSize: 11.5, fontWeight: 300, lineHeight: 1.45,
                    color: 'var(--color-text-secondary)',
                    animation: 'worldview-reveal var(--reveal-duration) var(--reveal-ease)',
                  }}
                >
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 400 }}>
                    {withUnit(b.value, subject.unit)}
                  </span>
                  {!isSubject && ratio ? ` — ${ratio.toLowerCase()}` : ''}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

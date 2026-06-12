'use client'

import { useState, useMemo } from 'react'
import { DistributionVsAnecdoteProps } from './schemas'

// Compact number formatting so far-tail tick labels stay readable.
function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k'
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}

export function DistributionVsAnecdote({ props }: { props: DistributionVsAnecdoteProps }) {
  const [shown, setShown] = useState(false)

  const L = useMemo(() => {
    const W = 520, padL = 18, padR = 18
    const DOT_R = 3.5, PITCH = 8, CAP = 14
    const calloutBand = 28
    const baselineY = calloutBand + CAP * PITCH
    const H = baselineY + 38

    const values = props.dataPoints.map((d) => d.value)
    const xMin = Math.min(...values, props.anecdote.value)
    const xMaxRaw = Math.max(...values, props.anecdote.value)
    const xMax = xMaxRaw === xMin ? xMin + 1 : xMaxRaw
    const xScale = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * (W - padL - padR)

    // Cap stack height: down-sample uniformly when the busiest bucket overflows.
    const maxCount = Math.max(...props.dataPoints.map((d) => d.count), 1)
    const scale = maxCount > CAP ? CAP / maxCount : 1
    const perDot = scale < 1 ? Math.max(1, Math.round(1 / scale)) : 1

    const dots: { cx: number; cy: number }[] = []
    for (const d of props.dataPoints) {
      const cx = xScale(d.value)
      const n = d.count <= 0 ? 0 : Math.max(1, Math.round(d.count * scale))
      for (let j = 0; j < n; j++) dots.push({ cx, cy: baselineY - DOT_R - j * PITCH })
    }

    const ticks = Array.from({ length: 5 }, (_, i) => {
      const v = xMin + ((xMax - xMin) * i) / 4
      return { x: xScale(v), v }
    })

    const ax = xScale(props.anecdote.value)
    return { W, H, padL, padR, baselineY, calloutBand, DOT_R, dots, ticks, ax, anchorEnd: ax > W * 0.62, perDot }
  }, [props.dataPoints, props.anecdote.value])

  const swatch = (color: string, glow?: boolean): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
    opacity: glow ? 1 : 0.65, boxShadow: glow ? '0 0 8px var(--color-ember-glow)' : 'none',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'var(--font-sans)' }}>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--color-text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={swatch('var(--color-node-visited)')} />distribution
          {L.perDot > 1 && <span style={{ color: 'var(--color-text-ghost)' }}>· each dot ≈ {fmt(L.perDot)}</span>}
        </span>
        {shown && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-ember)' }}>
            <span style={swatch('var(--color-ember)', true)} />{props.anecdote.label}
          </span>
        )}
      </div>

      {/* Dot plot */}
      <svg viewBox={`0 0 ${L.W} ${L.H}`} width="100%" style={{ display: 'block', height: 'auto', overflow: 'visible' }} role="img">
        {/* baseline axis */}
        <line x1={L.padL} y1={L.baselineY} x2={L.W - L.padR} y2={L.baselineY} stroke="var(--chart-axis)" strokeWidth={1} />

        {/* bulk distribution dots */}
        {L.dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={L.DOT_R} fill="var(--color-node-visited)" fillOpacity={0.65} />
        ))}

        {/* x ticks + labels */}
        {L.ticks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} y1={L.baselineY} x2={t.x} y2={L.baselineY + 5} stroke="var(--chart-tick)" strokeWidth={1} />
            <text x={t.x} y={L.baselineY + 17} textAnchor="middle" style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fill: 'var(--chart-tick-label)' }}>
              {fmt(t.v)}{props.xUnit ? ` ${props.xUnit}` : ''}
            </text>
          </g>
        ))}

        {/* axis title */}
        <text x={L.W / 2} y={L.baselineY + 33} textAnchor="middle" style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, fill: 'var(--color-text-secondary)' }}>
          {props.xLabel}
        </text>

        {/* anecdote: ember dot + callout, mounts on reveal */}
        {shown && (
          <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both' }}>
            <line x1={L.ax} y1={L.baselineY} x2={L.ax} y2={L.calloutBand} stroke="var(--color-ember-dim)" strokeWidth={1} strokeDasharray="4 3" />
            <circle cx={L.ax} cy={L.baselineY - L.DOT_R - 1} r={8} fill="var(--color-ember)" fillOpacity={0.28} />
            <circle cx={L.ax} cy={L.baselineY - L.DOT_R - 1} r={4} fill="var(--color-ember)" />
            <text x={L.ax + (L.anchorEnd ? -7 : 7)} y={11} textAnchor={L.anchorEnd ? 'end' : 'start'} style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, fill: 'var(--color-ember)' }}>
              {props.anecdote.label}
            </text>
            <text x={L.ax + (L.anchorEnd ? -7 : 7)} y={23} textAnchor={L.anchorEnd ? 'end' : 'start'} style={{ fontFamily: 'var(--font-serif)', fontSize: 12, fill: 'var(--color-text-secondary)' }}>
              {fmt(props.anecdote.value)}{props.xUnit ? ` ${props.xUnit}` : ''}
            </text>
          </g>
        )}
      </svg>

      {/* Trigger or reveal */}
      {!shown ? (
        <button
          onClick={() => setShown(true)}
          style={{
            alignSelf: 'flex-start', background: 'var(--color-s3)', color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
            padding: '7px 14px', fontSize: 13, fontFamily: 'var(--font-sans)', cursor: 'pointer',
            transition: 'border-color 150ms ease, background 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-ember-dim)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
        >
          Show {props.anecdote.label}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both' }}>
          <div style={{ padding: '12px 14px', background: 'var(--color-s2)', border: '1px solid var(--color-border-sub)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-ember-dim)', marginBottom: 6 }}>
              {props.anecdote.label}
            </span>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-text-primary)' }}>{props.anecdote.detail}</p>
          </div>
          <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.58, color: 'var(--color-text-primary)' }}>{props.insight}</p>
        </div>
      )}
    </div>
  )
}

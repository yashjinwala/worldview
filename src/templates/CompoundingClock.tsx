'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { CompoundingClockProps } from './schemas'

// curve-N default strokes (B16); 4th scenario falls back to a cool muted tone
const CURVE_COLORS = [
  'var(--curve-1-stroke)',
  'var(--curve-2-stroke)',
  'var(--curve-3-stroke)',
  'var(--color-text-secondary)',
]

// SVG coordinate space — scales fluidly via viewBox
const CHART_W = 600
const CHART_H = 300
const PLOT_X0 = 14
const PLOT_X1 = 504 // right margin reserved for end-value labels
const PLOT_Y0 = 18
const PLOT_Y1 = 266 // bottom margin reserved for x-axis ticks + label

function fmtNum(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  }
  if (Number.isInteger(n)) return n.toString()
  return n.toFixed(2)
}

function withUnit(n: number, unit: string): string {
  const s = fmtNum(n)
  if (/^[$€£¥]/.test(unit)) return `${unit}${s}`
  return `${s}${/^[a-zA-Z]/.test(unit) ? ' ' : ''}${unit}`
}

export function CompoundingClock({ props }: { props: CompoundingClockProps }) {
  const { unit, initialValue, timeLabel, timeSteps, scenarios, referenceValue } = props

  const svgRef = useRef<SVGSVGElement>(null)
  const [drawn, setDrawn] = useState(false)
  const [cursorT, setCursorT] = useState(timeSteps)
  const [dragging, setDragging] = useState(false)

  // trigger the left→right reveal on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const series = useMemo(
    () =>
      scenarios.map((sc, i) => {
        const values: number[] = []
        for (let t = 0; t <= timeSteps; t++) values.push(initialValue * Math.pow(1 + sc.rate, t))
        return {
          label: sc.label,
          rate: sc.rate,
          color: sc.color ?? CURVE_COLORS[i] ?? CURVE_COLORS[CURVE_COLORS.length - 1],
          values,
          finalValue: values[values.length - 1],
        }
      }),
    [scenarios, timeSteps, initialValue]
  )

  // linear y-domain scaled to the largest final value (and the reference, if higher)
  const { yMin, yMax } = useMemo(() => {
    const all = series.flatMap(s => s.values)
    if (referenceValue) all.push(referenceValue.value)
    const mn = Math.min(0, ...all)
    let mx = Math.max(...all)
    if (mx <= mn) mx = mn + 1
    return { yMin: mn, yMax: mx }
  }, [series, referenceValue])

  const xOf = (t: number) => PLOT_X0 + (timeSteps === 0 ? 0 : t / timeSteps) * (PLOT_X1 - PLOT_X0)
  const yOf = (v: number) => PLOT_Y1 - ((v - yMin) / (yMax - yMin)) * (PLOT_Y1 - PLOT_Y0)

  const paths = useMemo(
    () => series.map(s => s.values.map((v, t) => `${t === 0 ? 'M' : 'L'}${xOf(t).toFixed(2)},${yOf(v).toFixed(2)}`).join(' ')),
    [series, yMin, yMax, timeSteps]
  )

  const ticks = useMemo(() => Array.from(new Set([0, Math.round(timeSteps / 2), timeSteps])), [timeSteps])

  const tFromEvent = (e: React.PointerEvent<SVGSVGElement>): number => {
    const svg = svgRef.current
    if (!svg) return cursorT
    const rect = svg.getBoundingClientRect()
    const vbX = ((e.clientX - rect.left) / rect.width) * CHART_W
    const raw = ((vbX - PLOT_X0) / (PLOT_X1 - PLOT_X0)) * timeSteps
    return Math.max(0, Math.min(timeSteps, Math.round(raw)))
  }

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    setDragging(true)
    svgRef.current?.setPointerCapture(e.pointerId)
    setCursorT(tFromEvent(e))
  }
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging) setCursorT(tFromEvent(e))
  }
  const onUp = () => setDragging(false)

  const cursorX = xOf(cursorT)

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', width: '100%' }}>
      {/* ── Readout: each scenario's value at the cursor ── */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 'var(--text-caption-size)',
            letterSpacing: 'var(--text-caption-ls)',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          {cursorT} {timeLabel}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {series.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {s.rate >= 0 ? '+' : ''}{+(s.rate * 100).toFixed(2)}%
                </span>
              </span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500, color: s.color, letterSpacing: '-0.015em', flexShrink: 0 }}>
                {withUnit(s.values[cursorT], unit)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chart ── */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        width="100%"
        role="img"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        style={{ display: 'block', cursor: 'ew-resize', touchAction: 'none', userSelect: 'none' }}
      >
        {/* x-axis baseline */}
        <line x1={PLOT_X0} y1={PLOT_Y1} x2={PLOT_X1} y2={PLOT_Y1} stroke="var(--chart-axis)" strokeWidth={1} />

        {/* reference rule (B4) */}
        {referenceValue && (
          <g>
            <line
              x1={PLOT_X0}
              y1={yOf(referenceValue.value)}
              x2={PLOT_X1}
              y2={yOf(referenceValue.value)}
              stroke="var(--refline-color)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text x={PLOT_X0 + 4} y={yOf(referenceValue.value) - 5} fontSize={10} fill="var(--refline-label)" fontFamily="var(--font-sans)">
              {referenceValue.label}
            </text>
          </g>
        )}

        {/* scenario curves — reveal via normalized stroke-dashoffset */}
        {series.map((s, i) => (
          <path
            key={i}
            d={paths[i]}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={drawn ? 0 : 1}
            style={{ transition: `stroke-dashoffset 1900ms var(--ease-out) ${i * 120}ms` }}
          />
        ))}

        {/* time-cursor (B16) */}
        <line x1={cursorX} y1={PLOT_Y0} x2={cursorX} y2={PLOT_Y1} stroke="var(--curve-cursor)" strokeWidth={1} />
        {series.map((s, i) => (
          <circle
            key={i}
            cx={cursorX}
            cy={yOf(s.values[cursorT])}
            r={3.5}
            fill={s.color}
            stroke="var(--color-ground)"
            strokeWidth={1.5}
            style={{ opacity: drawn ? 1 : 0, transition: 'opacity 300ms var(--ease-out)' }}
          />
        ))}

        {/* end-of-range value labels, after the draw lands */}
        {series.map((s, i) => (
          <text
            key={i}
            x={PLOT_X1 + 7}
            y={yOf(s.finalValue) + 3.5}
            fontSize={11}
            fontFamily="var(--font-serif)"
            fontWeight={500}
            fill={s.color}
            style={{ opacity: drawn ? 1 : 0, transition: 'opacity 400ms var(--ease-out) 1600ms' }}
          >
            {withUnit(s.finalValue, unit)}
          </text>
        ))}

        {/* x-axis ticks + label */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={xOf(t)} y1={PLOT_Y1} x2={xOf(t)} y2={PLOT_Y1 + 4} stroke="var(--chart-tick)" strokeWidth={1} />
            <text x={xOf(t)} y={PLOT_Y1 + 16} fontSize={10} fill="var(--chart-tick-label)" fontFamily="var(--font-sans)" textAnchor="middle">
              {t}
            </text>
          </g>
        ))}
        <text
          x={(PLOT_X0 + PLOT_X1) / 2}
          y={CHART_H - 5}
          fontSize={10}
          fill="var(--chart-tick-label)"
          fontFamily="var(--font-sans)"
          textAnchor="middle"
          letterSpacing="0.06em"
          style={{ textTransform: 'uppercase' }}
        >
          {timeLabel}
        </text>
      </svg>
    </div>
  )
}

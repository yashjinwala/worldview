'use client'

import { useMemo, useRef, useState } from 'react'
import { DrawYourGuessProps } from './schemas'

// ── viewBox geometry (scales responsively; coords are pure SVG units) ──────────
const VB_W = 340
const VB_H = 230
const PAD_L = 42
const PAD_R = 14
const PAD_T = 14
const PAD_B = 34
const PX0 = PAD_L            // plot left  (y-axis)
const PX1 = VB_W - PAD_R     // plot right
const PY0 = PAD_T            // plot top
const PY1 = VB_H - PAD_B     // plot bottom (x-axis)

function fmt(n: number): string {
  if (!isFinite(n)) return ''
  if (Number.isInteger(n)) return Math.abs(n) >= 1000 ? n.toLocaleString() : String(n)
  return Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2).replace(/\.?0+$/, '')
}

export function DrawYourGuess({ props }: { props: DrawYourGuessProps }) {
  const { xLabel, yLabel, xUnit, yUnit, knownPoints, hiddenPoints, reveal } = props
  const svgRef = useRef<SVGSVGElement>(null)
  const [userPath, setUserPath] = useState<{ x: number; y: number }[]>([])
  const [drawing, setDrawing] = useState(false)
  const [revealed, setRevealed] = useState(false)

  // ── domain over the combined known+hidden cloud, y padded nicely ───────────
  const geo = useMemo(() => {
    const all = [...knownPoints, ...hiddenPoints]
    const xs = all.map((p) => p.x)
    const ys = all.map((p) => p.y)
    const xLo = Math.min(...xs)
    const xHi = Math.max(...xs)
    const yLo = Math.min(...ys)
    const yHi = Math.max(...ys)
    const yRange = yHi - yLo || Math.abs(yHi) || 1
    const yMin = yLo - yRange * 0.1
    const yMax = yHi + yRange * 0.1
    const maxKnownX = Math.max(...knownPoints.map((p) => p.x))
    const sx = (x: number) => PX0 + ((x - xLo) / (xHi - xLo || 1)) * (PX1 - PX0)
    const sy = (y: number) => PY1 - ((y - yMin) / (yMax - yMin || 1)) * (PY1 - PY0)
    return { xLo, xHi, yLo, yHi, maxKnownX, sx, sy, boundaryX: sx(maxKnownX) }
  }, [knownPoints, hiddenPoints])

  const { sx, sy, boundaryX } = geo
  const toPts = (a: { x: number; y: number }[]) => a.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')

  // actual hidden line continues from the last known point for visual continuity
  const lastKnown = knownPoints[knownPoints.length - 1]
  const actualPts = toPts([lastKnown, ...hiddenPoints])
  const userPts = userPath.map((p) => `${p.x},${p.y}`).join(' ')

  const yTicks = useMemo(() => [geo.yLo, (geo.yLo + geo.yHi) / 2, geo.yHi], [geo])
  const xTicks = useMemo(
    () => Array.from(new Set([geo.xLo, geo.maxKnownX, geo.xHi])),
    [geo]
  )

  // map a pointer event into clamped viewBox coords inside the hidden region
  function locate(e: React.PointerEvent): { x: number; y: number } | null {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return {
      x: Math.max(boundaryX, Math.min(PX1, p.x)),
      y: Math.max(PY0, Math.min(PY1, p.y)),
    }
  }

  function onDown(e: React.PointerEvent) {
    if (revealed) return
    const pt = locate(e)
    if (!pt) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setDrawing(true)
    setUserPath([pt])
  }
  function onMove(e: React.PointerEvent) {
    if (!drawing) return
    const pt = locate(e)
    if (pt) setUserPath((prev) => [...prev, pt])
  }
  function onUp() {
    setDrawing(false)
  }

  const axis = { stroke: 'var(--chart-axis)', strokeWidth: 1 }
  const tickLabel: React.CSSProperties = { fontSize: 9, fill: 'var(--chart-tick-label)', fontFamily: 'var(--font-sans)' }

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
      >
        {/* ghost canvas over the hidden x-range */}
        <rect x={boundaryX} y={PY0} width={PX1 - boundaryX} height={PY1 - PY0} fill="var(--sketch-canvas-bg)" />
        {/* boundary between given data and the guess zone */}
        <line x1={boundaryX} y1={PY0} x2={boundaryX} y2={PY1} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3 3" />

        {/* axes */}
        <line x1={PX0} y1={PY0} x2={PX0} y2={PY1} {...axis} />
        <line x1={PX0} y1={PY1} x2={PX1} y2={PY1} {...axis} />

        {/* y ticks */}
        {yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line x1={PX0 - 3} y1={sy(t)} x2={PX0} y2={sy(t)} stroke="var(--chart-tick)" strokeWidth={1} />
            <text x={PX0 - 6} y={sy(t) + 3} textAnchor="end" style={tickLabel}>{fmt(t)}</text>
          </g>
        ))}
        {/* x ticks */}
        {xTicks.map((t, i) => (
          <g key={`x${i}`}>
            <line x1={sx(t)} y1={PY1} x2={sx(t)} y2={PY1 + 3} stroke="var(--chart-tick)" strokeWidth={1} />
            <text x={sx(t)} y={PY1 + 14} textAnchor="middle" style={tickLabel}>{fmt(t)}</text>
          </g>
        ))}

        {/* axis labels */}
        <text x={(PX0 + PX1) / 2} y={VB_H - 4} textAnchor="middle" style={{ ...tickLabel, fill: 'var(--color-text-muted)' }}>
          {xLabel}{xUnit ? ` (${xUnit})` : ''}
        </text>
        <text transform={`rotate(-90 11 ${(PY0 + PY1) / 2})`} x={11} y={(PY0 + PY1) / 2} textAnchor="middle" style={{ ...tickLabel, fill: 'var(--color-text-muted)' }}>
          {yLabel}{yUnit ? ` (${yUnit})` : ''}
        </text>

        {/* known data — solid line + anchor dot */}
        <polyline points={toPts(knownPoints)} fill="none" stroke="var(--color-text-secondary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={sx(lastKnown.x)} cy={sy(lastKnown.y)} r={2.5} fill="var(--color-text-secondary)" />

        {/* user freehand guess */}
        {userPath.length > 1 && (
          <polyline points={userPts} fill="none" stroke="var(--sketch-user-stroke)" strokeWidth="var(--sketch-user-width)" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* the actual answer */}
        {revealed && (
          <>
            <polyline points={actualPts} fill="none" stroke="var(--sketch-actual-stroke)" strokeWidth="var(--sketch-actual-width)" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={sx(hiddenPoints[hiddenPoints.length - 1].x)} cy={sy(hiddenPoints[hiddenPoints.length - 1].y)} r={3} fill="var(--color-ember)" />
          </>
        )}

        {/* prompt + drag-capture overlay */}
        {userPath.length === 0 && !revealed && (
          <text x={(boundaryX + PX1) / 2} y={(PY0 + PY1) / 2} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--sketch-canvas-label)', fontFamily: 'var(--font-sans)' }}>
            Draw your guess
          </text>
        )}
        {!revealed && (
          <rect
            x={boundaryX}
            y={PY0}
            width={PX1 - boundaryX}
            height={PY1 - PY0}
            fill="transparent"
            style={{ cursor: 'crosshair', touchAction: 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        )}
      </svg>

      {/* control */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button
          onClick={() => setRevealed(true)}
          disabled={revealed}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            fontWeight: 500,
            padding: '7px 16px',
            color: revealed ? 'var(--color-text-muted)' : 'var(--color-ember)',
            background: 'transparent',
            border: `1px solid ${revealed ? 'var(--color-border)' : 'var(--color-ember-dim)'}`,
            borderRadius: 'var(--radius-sm)',
            cursor: revealed ? 'default' : 'pointer',
            transition: 'color 140ms ease, border-color 140ms ease',
          }}
        >
          Reveal
        </button>
      </div>

      {/* reveal text */}
      {revealed && (
        <div
          style={{
            animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both',
            marginTop: 12,
            padding: 16,
            background: 'var(--color-s2)',
            border: '1px solid var(--color-border-sub)',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            lineHeight: 1.6,
            fontWeight: 300,
            color: 'var(--color-text-primary)',
          }}
        >
          {reveal}
        </div>
      )}
    </div>
  )
}

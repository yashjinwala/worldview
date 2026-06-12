'use client'

import { useState } from 'react'
import { AnatomyLabelerProps } from './schemas'

type Region = AnatomyLabelerProps['regions'][number]

function centerOf(r: Region): { x: number; y: number } {
  return r.shape === 'rect' ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : { x: r.cx, y: r.cy }
}

// Point on a region's boundary in the direction of (tx, ty) — used so arrows
// connect shape edges, not centers (centers carry the always-visible pin label).
function edgeOf(r: Region, tx: number, ty: number): { x: number; y: number } {
  const c = centerOf(r)
  const dx = tx - c.x
  const dy = ty - c.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return c
  if (r.shape === 'circle') {
    return { x: c.x + (dx / len) * r.r, y: c.y + (dy / len) * r.r }
  }
  const hw = r.w / 2
  const hh = r.h / 2
  const t = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh)
  return { x: c.x + dx * t, y: c.y + dy * t }
}

export function AnatomyLabeler({ props }: { props: AnatomyLabelerProps }) {
  const { viewWidth: vw, viewHeight: vh, regions, connections, diagramLabel } = props
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // All geometry is expressed in viewBox units so the whole diagram scales as a unit.
  const minDim = Math.min(vw, vh)
  const strokeW = Math.max(minDim * 0.006, 1)
  const labelFs = minDim * 0.042
  const arrowFs = labelFs * 0.82

  const byId = (id: string) => regions.find((r) => r.id === id)
  const selected = selectedId ? byId(selectedId) : undefined

  function PinLabel({ r }: { r: Region }) {
    const c = centerOf(r)
    const isSel = r.id === selectedId
    const padX = labelFs * 0.55
    const pillH = labelFs * 1.7
    const pillW = r.label.length * labelFs * 0.55 + padX * 2
    return (
      <g
        onClick={() => setSelectedId(isSel ? null : r.id)}
        style={{ cursor: 'pointer' }}
      >
        <rect
          x={c.x - pillW / 2}
          y={c.y - pillH / 2}
          width={pillW}
          height={pillH}
          rx={pillH * 0.32}
          fill="var(--region-label-bg)"
          stroke={isSel ? 'var(--color-ember)' : 'var(--region-label-border)'}
          strokeWidth={strokeW * 0.8}
        />
        <text
          x={c.x}
          y={c.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-sans)"
          fontSize={labelFs}
          fontWeight={500}
          fill="var(--region-label-text)"
          style={{ userSelect: 'none' }}
        >
          {r.label}
        </text>
      </g>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '10px',
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'var(--color-text-muted)',
        }}
      >
        {diagramLabel}
      </span>

      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        style={{
          height: 'auto',
          display: 'block',
          background: 'var(--color-s1)',
          border: '1px solid var(--color-border-sub)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <defs>
          <marker
            id="al-arrow"
            viewBox="0 0 10 10"
            refX={8.5}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-text-muted)" />
          </marker>
        </defs>

        {/* Region shapes */}
        {regions.map((r) => {
          const isSel = r.id === selectedId
          const isHover = r.id === hoveredId && !isSel
          const fillOpacity = isSel || isHover ? 0.9 : 0.7
          const stroke = isSel ? 'var(--color-ember)' : 'var(--color-border)'
          const sw = isSel ? strokeW * 1.8 : strokeW * 0.6
          const common = {
            fill: r.fillColor,
            fillOpacity,
            stroke,
            strokeWidth: sw,
            onClick: () => setSelectedId(isSel ? null : r.id),
            onMouseEnter: () => setHoveredId(r.id),
            onMouseLeave: () => setHoveredId(null),
            style: { cursor: 'pointer', transition: 'fill-opacity 150ms ease' as const },
          }
          return r.shape === 'rect' ? (
            <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} rx={minDim * 0.012} {...common} />
          ) : (
            <circle key={r.id} cx={r.cx} cy={r.cy} r={r.r} {...common} />
          )
        })}

        {/* Connection arrows (edge to edge) */}
        {connections?.map((conn, i) => {
          const from = byId(conn.fromId)
          const to = byId(conn.toId)
          if (!from || !to || from.id === to.id) return null
          const cf = centerOf(from)
          const ct = centerOf(to)
          const p1 = edgeOf(from, ct.x, ct.y)
          const p2 = edgeOf(to, cf.x, cf.y)
          return (
            <line
              key={`c${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="var(--color-text-muted)"
              strokeWidth={strokeW}
              markerEnd="url(#al-arrow)"
            />
          )
        })}

        {/* Connection midpoint labels */}
        {connections?.map((conn, i) => {
          const from = byId(conn.fromId)
          const to = byId(conn.toId)
          if (!conn.label || !from || !to || from.id === to.id) return null
          const p1 = edgeOf(from, centerOf(to).x, centerOf(to).y)
          const p2 = edgeOf(to, centerOf(from).x, centerOf(from).y)
          const mx = (p1.x + p2.x) / 2
          const my = (p1.y + p2.y) / 2
          const w = conn.label.length * arrowFs * 0.55 + arrowFs
          const h = arrowFs * 1.6
          return (
            <g key={`cl${i}`}>
              <rect x={mx - w / 2} y={my - h / 2} width={w} height={h} rx={h * 0.32} fill="var(--region-label-bg)" />
              <text
                x={mx}
                y={my}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="var(--font-sans)"
                fontSize={arrowFs}
                fill="var(--region-arrow-label)"
                style={{ userSelect: 'none' }}
              >
                {conn.label}
              </text>
            </g>
          )
        })}

        {/* Always-visible pin labels (on top) */}
        {regions.map((r) => (
          <PinLabel key={`p${r.id}`} r={r} />
        ))}
      </svg>

      {selected ? (
        <div
          key={selected.id}
          style={{
            animation: 'worldview-reveal var(--reveal-duration) var(--reveal-ease) both',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '14px 16px',
            background: 'var(--region-panel-bg)',
            border: '1px solid var(--region-panel-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: 'var(--radius-sm)',
                background: selected.fillColor,
                border: '1px solid var(--color-border)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '16px',
                lineHeight: 1.35,
                letterSpacing: '-0.015em',
                color: 'var(--color-text-primary)',
              }}
            >
              {selected.label}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: '13.5px',
              lineHeight: 1.5,
              color: 'var(--color-text-secondary)',
            }}
          >
            {selected.description}
          </p>
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '13.5px',
            lineHeight: 1.5,
            color: 'var(--color-text-muted)',
          }}
        >
          Tap a region to reveal its role.
        </p>
      )}
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import { FeedbackLoopStepperProps } from './schemas'

// Circular causal-loop diagram. Geometry placed with trig (cx + r·cos, cy + r·sin);
// arrows are chords between adjacent node edges, with SVG marker arrowheads.
const VB_W = 360
const VB_H = 320
const CX = 180
const CY = 158
const R = 96
const NODE_R = 19

function wrapLabel(label: string): string[] {
  const words = label.trim().split(/\s+/)
  if (label.length <= 14 || words.length === 1) return [label]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

export function FeedbackLoopStepper({ props }: { props: FeedbackLoopStepperProps }) {
  const { steps, loopType, startingCondition, punchline } = props
  const n = steps.length

  // -1 = not started (showing the starting condition); 0..n-1 = active step index.
  const [active, setActive] = useState(-1)
  const done = active === n - 1

  const nodes = useMemo(
    () =>
      steps.map((_, i) => {
        const theta = -Math.PI / 2 + (i * 2 * Math.PI) / n
        return { x: CX + R * Math.cos(theta), y: CY + R * Math.sin(theta), cos: Math.cos(theta), sin: Math.sin(theta) }
      }),
    [steps, n]
  )

  const arrows = useMemo(
    () =>
      steps.map((s, i) => {
        const a = nodes[i]
        const b = nodes[(i + 1) % n]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        const sx = a.x + ux * NODE_R
        const sy = a.y + uy * NODE_R
        const ex = b.x - ux * (NODE_R + 6)
        const ey = b.y - uy * (NODE_R + 6)
        const mx = (sx + ex) / 2
        const my = (sy + ey) / 2
        let inx = CX - mx
        let iny = CY - my
        const il = Math.hypot(inx, iny) || 1
        return { sx, sy, ex, ey, lx: mx + (inx / il) * 14, ly: my + (iny / il) * 14, effect: s.effect }
      }),
    [nodes, steps, n]
  )

  function state(i: number): 'idle' | 'past' | 'active' {
    if (active < 0 || i > active) return 'idle'
    return i === active ? 'active' : 'past'
  }
  const arrowStroke = { idle: 'var(--loop-arrow-stroke)', past: 'var(--color-ember-dim)', active: 'var(--loop-arrow-active)' }
  const effectFill = { idle: 'var(--color-text-ghost)', past: 'var(--color-ember-dim)', active: 'var(--color-ember)' }

  const isRein = loopType === 'reinforcing'
  const chip = isRein
    ? { bg: 'rgba(224,112,64,0.16)', fg: 'var(--color-ember)', bd: 'rgba(224,112,64,0.32)' }
    : { bg: 'rgba(61,122,82,0.18)', fg: '#5aac72', bd: 'rgba(61,122,82,0.32)' }

  const cur = active >= 0 ? steps[active] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: 'var(--font-sans)' }}>

      {/* Header — loop type + starting condition */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ alignSelf: 'flex-start', background: chip.bg, color: chip.fg, border: `1px solid ${chip.bd}`, borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {loopType} loop
        </span>
        <div style={{ display: 'flex', gap: '8px', fontSize: '13px', lineHeight: 1.5 }}>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', paddingTop: '2px', flexShrink: 0 }}>Start</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>{startingCondition}</span>
        </div>
      </div>

      {/* Circular loop diagram */}
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ overflow: 'visible', display: 'block' }} role="img" aria-label="Feedback loop diagram">
        <defs>
          {(['idle', 'past', 'active'] as const).map(k => (
            <marker key={k} id={`fls-arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: arrowStroke[k] }} />
            </marker>
          ))}
        </defs>

        {/* Arrows (drawn first, beneath nodes) */}
        {arrows.map((ar, i) => {
          const st = state(i)
          return (
            <g key={`a${i}`}>
              <line x1={ar.sx} y1={ar.sy} x2={ar.ex} y2={ar.ey} markerEnd={`url(#fls-arrow-${st})`} style={{ stroke: arrowStroke[st], strokeWidth: st === 'active' ? 2.4 : 1.4, transition: 'stroke 220ms ease, stroke-width 220ms ease' }} />
              <text x={ar.lx} y={ar.ly} textAnchor="middle" dominantBaseline="middle" style={{ fill: effectFill[st], fontSize: '8px', fontWeight: 500, letterSpacing: '0.04em', transition: 'fill 220ms ease' }}>
                {ar.effect}
              </text>
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map((nd, i) => {
          const st = state(i)
          const border = st === 'active' ? 'var(--loop-node-active-border)' : st === 'past' ? 'var(--color-node-settled)' : 'var(--loop-node-border)'
          const numFill = st === 'active' ? 'var(--color-ember)' : st === 'past' ? 'var(--color-node-settled)' : 'var(--color-text-muted)'
          const labFill = st === 'active' ? 'var(--color-text-primary)' : st === 'past' ? 'var(--color-text-secondary)' : 'var(--color-text-muted)'
          const lines = wrapLabel(steps[i].label)
          const anchor = nd.cos > 0.25 ? 'start' : nd.cos < -0.25 ? 'end' : 'middle'
          const lx = nd.x + nd.cos * (NODE_R + 7)
          const above = nd.sin < -0.25
          const baseY = nd.y + nd.sin * (NODE_R + 9) + (above ? -(lines.length - 1) * 10 : 0)
          return (
            <g key={`n${i}`}>
              {st === 'active' && <circle cx={nd.x} cy={nd.y} r={NODE_R + 4} fill="none" style={{ stroke: 'var(--color-ember-glow)', strokeWidth: 6 }} />}
              <circle cx={nd.x} cy={nd.y} r={NODE_R} style={{ fill: 'var(--loop-node-bg)', stroke: border, strokeWidth: st === 'active' ? 2 : 1.2, transition: 'stroke 220ms ease' }} />
              <text x={nd.x} y={nd.y} textAnchor="middle" dominantBaseline="central" style={{ fill: numFill, fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-serif)', transition: 'fill 220ms ease' }}>
                {i + 1}
              </text>
              <text x={lx} y={baseY} textAnchor={anchor} dominantBaseline="middle" style={{ fill: labFill, fontSize: '9px', fontWeight: 400, transition: 'fill 220ms ease' }}>
                {lines.map((ln, li) => (
                  <tspan key={li} x={lx} dy={li === 0 ? 0 : 10}>{ln}</tspan>
                ))}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Active-step description panel */}
      <div style={{ background: 'var(--color-s2)', border: '1px solid var(--color-border-sub)', borderRadius: 'var(--radius-md)', padding: '12px 14px', minHeight: '74px' }}>
        {cur ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '15px', color: 'var(--color-text-primary)' }}>{cur.label}</span>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Step {active + 1} of {n}</span>
            </div>
            <div style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>{cur.description}</div>
            <div style={{ marginTop: '7px', fontSize: '11.5px', color: 'var(--color-ember)' }}>
              → {cur.effect} the next step{active === n - 1 ? ' — closing the loop' : ''}
            </div>
          </>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
            Each step feeds the next. Walk the cycle one step at a time to feel it {isRein ? 'build' : 'settle'}.
          </div>
        )}
      </div>

      {/* Advance / restart control */}
      <button
        onClick={() => setActive(prev => (prev >= n - 1 ? -1 : prev + 1))}
        style={{ alignSelf: 'flex-start', background: 'var(--color-s3)', border: `1px solid ${done ? 'var(--color-border)' : 'var(--color-ember-dim)'}`, borderRadius: 'var(--radius-sm)', padding: '7px 16px', fontSize: '12.5px', fontFamily: 'var(--font-sans)', color: done ? 'var(--color-text-secondary)' : 'var(--color-ember)', cursor: 'pointer', transition: 'color 150ms ease, border-color 150ms ease' }}
      >
        {active < 0 ? 'Begin the loop' : done ? 'Run it again' : 'Next step'}
      </button>

      {/* Punchline — the loop has closed */}
      {done && (
        <div style={{ background: 'var(--loop-punchline-bg)', border: '1px solid var(--loop-punchline-border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both' }}>
          <div style={{ fontSize: '10px', color: '#5aac72', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '7px' }}>
            {isRein ? 'Reinforcing — it amplifies over time' : 'Balancing — it self-corrects'}
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', fontStyle: 'italic', color: 'var(--color-text-primary)', lineHeight: 1.58 }}>
            {punchline}
          </div>
        </div>
      )}

    </div>
  )
}

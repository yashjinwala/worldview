'use client'

import { useState } from 'react'
import { SurvivorshipFilterProps } from './schemas'

const REVEAL = 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both'

export function SurvivorshipFilter({ props }: { props: SurvivorshipFilterProps }) {
  const { startLabel, startTotal, stages, visibleGroup, insight } = props
  const [revealed, setRevealed] = useState(0)

  const total = startTotal > 0 ? startTotal : 1
  const pct = (n: number) => `${(n / total) * 100}%`
  const fmt = (n: number) => n.toLocaleString('en-US')
  const allDone = revealed >= stages.length

  const caption: React.CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: 'var(--color-text-secondary)',
  }
  const count: React.CSSProperties = {
    fontFamily: 'var(--font-serif)',
    fontSize: '15px',
    fontWeight: 500,
    letterSpacing: '-0.015em',
    lineHeight: 1,
  }
  const track: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    height: '30px',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    background: 'var(--color-s1)',
    border: '1px solid var(--color-border-sub)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'var(--font-sans)' }}>
      {/* Population — top of the funnel, full width */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
          <span style={caption}>{startLabel}</span>
          <span style={{ ...count, color: 'var(--color-text-primary)' }}>{fmt(startTotal)}</span>
        </div>
        <div style={track}>
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--funnel-stage-fill)',
              opacity: 'var(--funnel-stage-opacity)',
            }}
          />
        </div>
      </div>

      {/* Stages — each revealed one narrows the funnel */}
      {stages.slice(0, revealed).map((s, i) => {
        const isFinal = i === stages.length - 1
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', animation: REVEAL }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
              <span style={caption}>{s.label}</span>
              <span style={{ ...count, color: isFinal ? 'var(--color-ember)' : 'var(--color-text-primary)' }}>
                {isFinal ? `${visibleGroup} · ${fmt(s.surviving)}` : fmt(s.surviving)}
              </span>
            </div>

            <div style={track}>
              {/* surviving — proportional to the original population */}
              <div
                style={{
                  flexShrink: 0,
                  width: pct(s.surviving),
                  height: '100%',
                  background: isFinal ? 'var(--funnel-survivor-fill)' : 'var(--funnel-stage-fill)',
                  opacity: isFinal ? 'var(--funnel-survivor-opacity)' : 'var(--funnel-stage-opacity)',
                  transition: 'background 200ms ease',
                }}
              />
              {/* dropped — faded segment back to the prior stage's width */}
              <div
                style={{
                  flexShrink: 0,
                  width: pct(s.dropped),
                  height: '100%',
                  background: 'var(--color-s4)',
                  opacity: 0.5,
                  borderLeft: s.dropped > 0 ? '1px solid var(--color-border-sub)' : 'none',
                }}
              />
            </div>

            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11.5px',
                fontWeight: 300,
                lineHeight: 1.45,
                color: 'var(--funnel-drop-label)',
              }}
            >
              {fmt(s.dropped)} dropped — {s.dropReason}
            </span>
          </div>
        )
      })}

      {/* Advance control — reveals the next stage of the filter */}
      {!allDone && (
        <button
          onClick={() => setRevealed(r => r + 1)}
          style={{
            alignSelf: 'flex-start',
            marginTop: '2px',
            padding: '7px 14px',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--color-ember)',
            background: 'transparent',
            border: '1px solid var(--color-ember-dim)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(224,112,64,0.08)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
        >
          Next: {stages[revealed].label}
        </button>
      )}

      {/* Insight — lands after every stage has filtered */}
      {allDone && (
        <div
          style={{
            padding: '16px 18px',
            background: 'var(--color-s1)',
            border: '1px solid var(--color-border-sub)',
            borderRadius: 'var(--radius-md)',
            animation: REVEAL,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: '13.5px',
              lineHeight: 1.6,
              color: 'var(--color-text-secondary)',
            }}
          >
            {insight}
          </p>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { SteelmanDuelProps } from './schemas'

type Lean = 'A' | 'torn' | 'B'

export function SteelmanDuel({ props }: { props: SteelmanDuelProps }) {
  const [lean, setLean] = useState<Lean | null>(null)
  const committed = lean !== null

  // Both panels are intentionally IDENTICAL — equal visual weight, no advantage
  // to either side, before or after the user commits (TDD §10: "see the other
  // side has a real argument").
  const panelStyle: React.CSSProperties = {
    flex: '1 1 240px',
    minWidth: 0,
    padding: '18px',
    background: 'var(--duel-panel-bg)',
    border: '1px solid var(--duel-panel-border)',
    borderRadius: 'var(--duel-panel-radius)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  }

  function renderPanel(side: SteelmanDuelProps['sideA']) {
    return (
      <div style={panelStyle}>
        <span style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '14px',
          fontWeight: 500,
          lineHeight: '1.35',
          letterSpacing: '-0.015em',
          color: 'var(--color-text-primary)',
        }}>
          {side.label}
        </span>
        <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {side.points.map((p, i) => (
            <li key={i} style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              lineHeight: '1.55',
              color: 'var(--color-text-muted)',
            }}>
              {p}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  function leanButton(value: Lean, text: string) {
    const active = lean === value
    return (
      <button
        onClick={() => setLean(value)}
        style={{
          flex: 1,
          padding: '9px 12px',
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.04em',
          color: active ? 'var(--color-ember)' : 'var(--color-text-secondary)',
          background: active ? 'rgba(224,112,64,0.08)' : 'transparent',
          border: `1px solid ${active ? 'var(--color-ember-dim)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease',
        }}
      >
        {text}
      </button>
    )
  }

  const contested = props.consensusLeans === 'neither'
  const consensusText = props.consensusLeans === 'A'
    ? props.sideA.label
    : props.consensusLeans === 'B'
      ? props.sideB.label
      : 'genuinely contested'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* The question both sides answer */}
      <p style={{
        margin: 0,
        fontFamily: 'var(--font-serif)',
        fontSize: '15px',
        lineHeight: '1.55',
        letterSpacing: '-0.015em',
        color: 'var(--color-text-primary)',
      }}>
        {props.question}
      </p>

      {/* Two steelmanned sides — identical weight, divided down the middle */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 0 }}>
        {renderPanel(props.sideA)}
        <div style={{
          flex: '0 0 1px',
          alignSelf: 'stretch',
          background: 'var(--duel-divider)',
          margin: '0 16px',
        }} />
        {renderPanel(props.sideB)}
      </div>

      {/* Where do you lean? */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {leanButton('A', `I lean ${props.sideA.label}`)}
        {leanButton('torn', "I'm torn")}
        {leanButton('B', `I lean ${props.sideB.label}`)}
      </div>

      {/* Synthesis — the neutral-positive payoff, only after committing */}
      {committed && (
        <div style={{
          padding: '16px 18px',
          background: 'var(--duel-synthesis-bg)',
          border: '1px solid var(--duel-synthesis-border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both',
        }}>
          <p style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '13.5px',
            lineHeight: '1.6',
            color: 'var(--color-text-secondary)',
          }}>
            {props.synthesis}
          </p>

          {props.consensusLeans && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px',
              paddingTop: '12px',
              borderTop: '1px solid var(--color-border-sub)',
            }}>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: 'var(--duel-leans-label)',
              }}>
                Where expert consensus sits
              </span>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: 500,
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                color: contested ? 'var(--color-text-secondary)' : 'var(--color-ember)',
                background: contested ? 'transparent' : 'rgba(156,78,44,0.14)',
                border: `1px solid ${contested ? 'var(--color-border)' : 'var(--duel-leans-indicator)'}`,
              }}>
                {consensusText}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

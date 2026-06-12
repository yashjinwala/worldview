'use client'

import { useState } from 'react'
import { TradeoffProps } from './schemas'

export function Tradeoff({ props }: { props: TradeoffProps }) {
  const [chosen, setChosen] = useState<'A' | 'B' | null>(null)

  const picked = chosen !== null

  function panelStyle(side: 'A' | 'B'): React.CSSProperties {
    if (!picked) {
      return {
        flex: 1,
        padding: '20px',
        background: 'var(--tradeoff-panel-bg)',
        border: '1px solid var(--tradeoff-panel-border)',
        borderRadius: 'var(--tradeoff-panel-radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'opacity 200ms ease, border-color 200ms ease, background 200ms ease',
      }
    }
    const isChosen = chosen === side
    return {
      flex: 1,
      padding: '20px',
      background: isChosen ? 'var(--tradeoff-chosen-bg)' : 'var(--tradeoff-panel-bg)',
      border: `1px solid ${isChosen ? 'var(--tradeoff-chosen-border)' : 'var(--tradeoff-panel-border)'}`,
      borderRadius: 'var(--tradeoff-panel-radius)',
      opacity: isChosen ? 1 : 0.65,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      transition: 'opacity 200ms ease, border-color 200ms ease, background 200ms ease',
    }
  }

  function pickButtonStyle(side: 'A' | 'B'): React.CSSProperties {
    return {
      marginTop: '4px',
      padding: '7px 14px',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      fontWeight: 500,
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      color: 'var(--color-ember)',
      background: 'transparent',
      border: '1px solid var(--color-ember-dim)',
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
      alignSelf: 'flex-start',
      transition: 'background 150ms ease, color 150ms ease',
    }
  }

  function renderConsequences(consequences: string[]) {
    return (
      <ul style={{
        margin: 0,
        paddingLeft: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
      }}>
        {consequences.map((c, i) => (
          <li key={i} style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            lineHeight: '1.55',
            color: 'var(--color-text-muted)',
          }}>
            {c}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Scenario */}
      <p style={{
        margin: 0,
        fontFamily: 'var(--font-serif)',
        fontSize: '15px',
        lineHeight: '1.55',
        color: 'var(--color-text-primary)',
        letterSpacing: '-0.015em',
      }}>
        {props.scenario}
      </p>

      {/* Option panels */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        {/* Panel A */}
        <div style={panelStyle('A')}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: '1.35',
            letterSpacing: '-0.015em',
            color: chosen === 'A' ? 'var(--color-ember)' : 'var(--color-text-primary)',
            transition: 'color 200ms ease',
          }}>
            {props.optionA.label}
          </span>

          {picked && renderConsequences(props.optionA.consequences)}

          {!picked && (
            <button
              style={pickButtonStyle('A')}
              onClick={() => setChosen('A')}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(224,112,64,0.08)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              I&apos;ll pick {props.optionA.label}
            </button>
          )}
        </div>

        {/* Panel B */}
        <div style={panelStyle('B')}>
          <span style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: '1.35',
            letterSpacing: '-0.015em',
            color: chosen === 'B' ? 'var(--color-ember)' : 'var(--color-text-primary)',
            transition: 'color 200ms ease',
          }}>
            {props.optionB.label}
          </span>

          {picked && renderConsequences(props.optionB.consequences)}

          {!picked && (
            <button
              style={pickButtonStyle('B')}
              onClick={() => setChosen('B')}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(224,112,64,0.08)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              I&apos;ll pick {props.optionB.label}
            </button>
          )}
        </div>
      </div>

      {/* Insight block — revealed after picking */}
      {picked && (
        <div style={{
          padding: '16px 18px',
          background: 'var(--tradeoff-insight-bg)',
          border: '1px solid var(--tradeoff-insight-border)',
          borderRadius: 'var(--radius-md)',
          animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both',
        }}>
          <p style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '13.5px',
            lineHeight: '1.6',
            color: 'var(--color-text-secondary)',
          }}>
            {props.insight}
          </p>
        </div>
      )}
    </div>
  )
}

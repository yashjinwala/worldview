'use client'

import { useState } from 'react'
import { PredictRevealProps } from './schemas'

export function PredictReveal({ props }: { props: PredictRevealProps }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const locked = selectedIndex !== null

  function handleSelect(idx: number) {
    if (!locked) setSelectedIndex(idx)
  }

  function getButtonStyle(idx: number): React.CSSProperties {
    const isCorrect = idx === props.correctIndex
    const isChosen = idx === selectedIndex
    const isHovered = !locked && hoveredIndex === idx

    if (locked && isCorrect) {
      return {
        display: 'block',
        width: '100%',
        padding: '11px 16px',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        fontSize: '14px',
        lineHeight: '1.6',
        color: 'var(--feedback-correct-text)',
        background: 'var(--feedback-correct-bg)',
        border: '1px solid var(--feedback-correct-border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'default',
        transition: 'none',
      }
    }

    if (locked && isChosen) {
      return {
        display: 'block',
        width: '100%',
        padding: '11px 16px',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
        fontSize: '14px',
        lineHeight: '1.6',
        color: 'var(--feedback-incorrect-text)',
        background: 'var(--feedback-incorrect-bg)',
        border: '1px solid var(--feedback-incorrect-border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'default',
        transition: 'none',
      }
    }

    return {
      display: 'block',
      width: '100%',
      padding: '11px 16px',
      textAlign: 'left',
      fontFamily: 'var(--font-sans)',
      fontSize: '14px',
      lineHeight: '1.6',
      color: locked ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
      background: isHovered ? 'var(--color-s3)' : 'var(--color-s2)',
      border: `1px solid ${isHovered ? 'var(--color-ember-dim)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius-md)',
      cursor: locked ? 'default' : 'pointer',
      opacity: locked ? 0.45 : 1,
      transition: 'border-color 140ms ease, background 140ms ease, opacity 140ms ease',
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '16px',
          lineHeight: '1.35',
          letterSpacing: '-0.015em',
          fontWeight: 400,
          color: 'var(--color-text-primary)',
          margin: 0,
        }}
      >
        {props.question}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {props.options.map((option, idx) => (
          <button
            key={idx}
            disabled={locked}
            onClick={() => handleSelect(idx)}
            onMouseEnter={() => { if (!locked) setHoveredIndex(idx) }}
            onMouseLeave={() => setHoveredIndex(null)}
            style={getButtonStyle(idx)}
          >
            {option}
          </button>
        ))}
      </div>

      {locked && (
        <div
          style={{
            animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px',
            background: 'var(--color-s2)',
            border: '1px solid var(--color-border-sub)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              lineHeight: '1.6',
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {props.reveal}
          </p>
          <div>
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                fontWeight: 500,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: 'var(--color-ember-dim)',
                marginBottom: '6px',
              }}
            >
              Why Your Guess Was Reasonable
            </span>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '13.5px',
                lineHeight: '1.5',
                color: 'var(--color-text-muted)',
                margin: 0,
              }}
            >
              {props.whyYourGuessWasReasonable}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

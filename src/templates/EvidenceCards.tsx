'use client'

import { useState } from 'react'
import { EvidenceCardsProps } from './schemas'

type Pile = 'supports' | 'challenges'

export function EvidenceCards({ props }: { props: EvidenceCardsProps }) {
  const { claim, cards, verdict } = props
  const [assigned, setAssigned] = useState<Record<number, Pile | null>>(
    () => Object.fromEntries(cards.map((_, i) => [i, null]))
  )

  const allPlaced = cards.every((_, i) => assigned[i] !== null)

  const assign = (index: number, pile: Pile) => {
    if (allPlaced) return
    setAssigned(prev => ({ ...prev, [index]: pile }))
  }

  const getFeedback = (index: number): 'correct' | 'incorrect' | null => {
    if (!allPlaced) return null
    const pile = assigned[index]
    if (!pile) return null
    const isCorrect = (pile === 'supports') === cards[index].supports
    return isCorrect ? 'correct' : 'incorrect'
  }

  const byPile = (pile: Pile) => cards.map((_, i) => i).filter(i => assigned[i] === pile)
  const unassigned = cards.map((_, i) => i).filter(i => assigned[i] === null)

  const cardBg = (fb: 'correct' | 'incorrect' | null) => {
    if (fb === 'correct') return 'rgba(61,122,82,0.18)'
    if (fb === 'incorrect') return 'rgba(200,72,32,0.18)'
    return 'var(--color-s3)'
  }
  const cardBorderColor = (fb: 'correct' | 'incorrect' | null) => {
    if (fb === 'correct') return 'rgba(61,122,82,0.50)'
    if (fb === 'incorrect') return 'rgba(200,72,32,0.50)'
    return 'var(--color-border)'
  }
  const headlineColor = (fb: 'correct' | 'incorrect' | null) => {
    if (fb === 'correct') return '#5aac72'
    if (fb === 'incorrect') return '#e05030'
    return 'var(--color-text-primary)'
  }

  const renderCard = (index: number, showButtons: boolean) => {
    const card = cards[index]
    const fb = getFeedback(index)
    return (
      <div
        key={index}
        style={{
          background: cardBg(fb),
          border: `1px solid ${cardBorderColor(fb)}`,
          borderRadius: 'var(--radius-md)',
          padding: '10px',
          marginBottom: '6px',
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            fontWeight: 500,
            color: headlineColor(fb),
            lineHeight: 1.35,
            marginBottom: '4px',
          }}
        >
          {card.headline}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11.5px',
            fontWeight: 300,
            color: 'var(--color-text-muted)',
            lineHeight: 1.45,
            marginBottom: showButtons ? '8px' : 0,
          }}
        >
          {card.body}
        </div>
        {showButtons && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['supports', 'challenges'] as const).map(pile => (
              <button
                key={pile}
                onClick={() => assign(index, pile)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  lineHeight: 1.4,
                }}
              >
                {pile === 'supports' ? '→ Supports' : '→ Challenges'}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const dropZoneStyle = (active: boolean) => ({
    background: active ? 'rgba(224,112,64,0.06)' : 'var(--color-s2)',
    border: `1px solid ${active ? 'var(--color-ember-dim)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-md)',
    padding: '10px',
    minHeight: '80px',
    flex: 1 as const,
  })

  const columnLabelStyle = {
    fontFamily: 'var(--font-sans)',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
    color: 'var(--color-text-muted)',
    marginBottom: '8px',
  }

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Claim panel */}
      <div
        style={{
          background: 'var(--color-s2)',
          border: '1px solid var(--color-border-sub)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '15px',
            fontWeight: 400,
            color: 'var(--color-text-primary)',
            lineHeight: 1.45,
          }}
        >
          {claim}
        </div>
      </div>

      {/* Unassigned queue */}
      {unassigned.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {unassigned.map(i => renderCard(i, true))}
        </div>
      )}

      {/* Two piles */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={dropZoneStyle(false)}>
          <div style={columnLabelStyle}>Supports</div>
          {byPile('supports').map(i => renderCard(i, false))}
        </div>
        <div style={dropZoneStyle(false)}>
          <div style={columnLabelStyle}>Challenges</div>
          {byPile('challenges').map(i => renderCard(i, false))}
        </div>
      </div>

      {/* Verdict */}
      {allPlaced && (
        <div
          style={{
            marginTop: '14px',
            background: 'var(--color-s1)',
            border: '1px solid var(--color-border-sub)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '13.5px',
              fontWeight: 300,
              color: 'var(--color-text-primary)',
              lineHeight: 1.58,
            }}
          >
            {verdict}
          </div>
        </div>
      )}
    </div>
  )
}

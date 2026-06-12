'use client'

import { useMemo, useState } from 'react'
import { RankTheListProps } from './schemas'

export function RankTheList({ props }: { props: RankTheListProps }) {
  const { question, items, correctRanking, insight } = props

  const itemsById = useMemo(
    () => Object.fromEntries(items.map((it) => [it.id, it])),
    [items]
  )

  // user-controlled order (ids). Items arrive un-sorted; this is the working list.
  const [order, setOrder] = useState<string[]>(() => items.map((it) => it.id))
  const [submitted, setSubmitted] = useState(false)

  const move = (index: number, dir: -1 | 1) => {
    if (submitted) return
    const target = index + dir
    if (target < 0 || target >= order.length) return
    setOrder((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  // after submit the list is displayed in the CORRECT order; before, in user order.
  const displayOrder = submitted ? correctRanking : order

  // delta = userRank − correctRank (1-indexed). >0 ranked too low (↑) ; <0 too high (↓).
  const deltaFor = (id: string) => order.indexOf(id) - correctRanking.indexOf(id)

  const badge = (id: string) => {
    const d = deltaFor(id)
    const correct = d === 0
    const color = correct
      ? 'var(--rank-delta-correct)'
      : d > 0
        ? 'var(--rank-delta-up)'
        : 'var(--rank-delta-down)'
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          minWidth: '34px',
          justifyContent: 'center',
          padding: '3px 8px',
          borderRadius: 'var(--radius-full)',
          fontFamily: 'var(--font-sans)',
          fontSize: '11.5px',
          fontWeight: 500,
          color,
          background: `color-mix(in srgb, ${color} 16%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
          lineHeight: 1,
        }}
      >
        {correct ? '✓' : `${d > 0 ? '↑' : '↓'}${Math.abs(d)}`}
      </span>
    )
  }

  const stepBtn = (index: number, dir: -1 | 1) => {
    const disabled = dir === -1 ? index === 0 : index === order.length - 1
    return (
      <button
        onClick={() => move(index, dir)}
        disabled={disabled}
        aria-label={dir === -1 ? 'Move up' : 'Move down'}
        style={{
          width: '26px',
          height: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          color: disabled ? 'var(--color-text-ghost)' : 'var(--color-text-secondary)',
          fontSize: '12px',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color 140ms ease, color 140ms ease',
        }}
      >
        {dir === -1 ? '↑' : '↓'}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'var(--font-sans)' }}>
      <p
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '16px',
          lineHeight: 1.35,
          letterSpacing: '-0.015em',
          fontWeight: 400,
          color: 'var(--color-text-primary)',
          margin: 0,
        }}
      >
        {question}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {displayOrder.map((id, index) => {
          const item = itemsById[id]
          return (
            <div
              key={id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                background: 'var(--color-s3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                animation: submitted
                  ? 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both'
                  : undefined,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: '20px',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.4,
                }}
              >
                {index + 1}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13.5px',
                    fontWeight: 400,
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.4,
                  }}
                >
                  {item.label}
                </div>
                {submitted && item.detail && (
                  <div
                    style={{
                      marginTop: '4px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11.5px',
                      fontWeight: 300,
                      color: 'var(--color-text-muted)',
                      lineHeight: 1.45,
                    }}
                  >
                    {item.detail}
                  </div>
                )}
              </div>

              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {submitted ? (
                  badge(id)
                ) : (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {stepBtn(index, -1)}
                    {stepBtn(index, 1)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {!submitted ? (
        <button
          onClick={() => setSubmitted(true)}
          style={{
            alignSelf: 'flex-start',
            padding: '8px 16px',
            background: 'var(--color-ember)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-ground)',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Submit ranking
        </button>
      ) : (
        <div
          style={{
            animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both',
            background: 'var(--color-s1)',
            border: '1px solid var(--color-border-sub)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
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
            The actual order
          </span>
          <p
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '13.5px',
              fontStyle: 'italic',
              fontWeight: 300,
              color: 'var(--color-text-primary)',
              lineHeight: 1.58,
              margin: 0,
            }}
          >
            {insight}
          </p>
        </div>
      )}
    </div>
  )
}

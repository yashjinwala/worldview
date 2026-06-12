'use client'

import { useState, useMemo } from 'react'
import { TimelineProps } from './schemas'

export function Timeline({ props }: { props: TimelineProps }) {
  const sorted = useMemo(
    () => [...props.events].sort((a, b) => a.year - b.year),
    [props.events]
  )

  const [tappedSet, setTappedSet] = useState<Set<number>>(new Set())
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [manualReveal, setManualReveal] = useState(false)

  const allTapped = tappedSet.size === sorted.length
  const showPattern = manualReveal || allTapped

  function handleMarker(i: number) {
    setTappedSet(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
    setActiveIdx(prev => (prev === i ? null : i))
  }

  const activeEvent = activeIdx !== null ? sorted[activeIdx] : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Scrollable track */}
      <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          minWidth: `${Math.max(sorted.length * 90, 320)}px`,
          position: 'relative',
        }}>
          {/* Horizontal track line */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: '2px',
            background: 'var(--color-border)',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }} />

          {sorted.map((ev, i) => {
            const isTapped = tappedSet.has(i)
            const isActive = activeIdx === i
            const yearStr = ev.yearLabel ?? String(ev.year)
            const above = i % 2 === 0

            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* Top slot — label for even-index events */}
                <div style={{
                  height: '52px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingBottom: '9px',
                  gap: '2px',
                }}>
                  {above && <>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>{yearStr}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', maxWidth: '84px', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{ev.label}</span>
                  </>}
                </div>

                {/* Marker dot */}
                <button
                  onClick={() => handleMarker(i)}
                  aria-pressed={isTapped}
                  aria-label={`${yearStr}: ${ev.label}`}
                  style={{
                    flexShrink: 0,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: isTapped ? '#58789e' : 'var(--color-s4)',
                    border: `2px solid ${isTapped ? '#58789e' : 'var(--color-border)'}`,
                    outline: isActive ? '2px solid rgba(88,120,158,0.55)' : 'none',
                    outlineOffset: '2px',
                    cursor: 'pointer',
                    padding: 0,
                    position: 'relative',
                    zIndex: 1,
                    transition: 'background 150ms ease, border-color 150ms ease',
                  }}
                />

                {/* Bottom slot — label for odd-index events */}
                <div style={{
                  height: '52px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  paddingTop: '9px',
                  gap: '2px',
                }}>
                  {!above && <>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>{yearStr}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', maxWidth: '84px', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{ev.label}</span>
                  </>}
                </div>

              </div>
            )
          })}
        </div>
      </div>

      {/* Detail card — one at a time */}
      {activeEvent && (
        <div style={{
          background: 'var(--color-s2)',
          border: '1px solid var(--color-border-sub)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
        }}>
          <div style={{
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            {activeEvent.yearLabel ?? activeEvent.year} — {activeEvent.label}
          </div>
          <div style={{
            fontSize: '13.5px',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.55,
          }}>
            {activeEvent.detail}
          </div>
        </div>
      )}

      {/* Reveal pattern button — always shown */}
      <button
        onClick={() => setManualReveal(true)}
        disabled={showPattern}
        style={{
          alignSelf: 'flex-start',
          background: 'transparent',
          border: `1px solid ${showPattern ? 'var(--color-border-sub)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-sm)',
          padding: '5px 12px',
          fontSize: '11.5px',
          color: showPattern ? 'var(--color-text-ghost)' : 'var(--color-text-secondary)',
          fontFamily: 'var(--font-sans)',
          cursor: showPattern ? 'default' : 'pointer',
          transition: 'color 150ms ease, border-color 150ms ease',
        }}
      >
        Reveal pattern
      </button>

      {/* Pattern block — revealed after all tapped or button clicked */}
      {showPattern && (
        <div style={{
          background: 'rgba(61,122,82,0.10)',
          border: '1px solid rgba(61,122,82,0.30)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both',
        }}>
          <div style={{
            fontSize: '14px',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-serif)',
            lineHeight: 1.58,
            fontStyle: 'italic',
          }}>
            {props.pattern}
          </div>
        </div>
      )}

    </div>
  )
}

'use client'

import { useState } from 'react'
import { CounterfactualForkProps } from './schemas'

const REVEAL = 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both'

type ForkEvent = { year: string; outcome: string }

export function CounterfactualFork({ props }: { props: CounterfactualForkProps }) {
  const actual = props.actualPath
  const counter = props.counterfactualPath
  const aN = actual.events.length
  const cN = counter.events.length

  const [aStep, setAStep] = useState(0)
  const [cStep, setCStep] = useState(0)

  const actualDone = aStep >= aN
  const allDone = actualDone && cStep >= cN

  function advance() {
    if (aStep < aN) setAStep((s) => s + 1)
    else if (cStep < cN) setCStep((s) => s + 1)
  }

  function buttonLabel(): string {
    if (aStep === 0) return 'Trace what happened'
    if (aStep < aN) return 'Next'
    if (cStep === 0) return 'Explore the road not taken'
    return 'Next'
  }

  function renderBranch(label: string, events: ForkEvent[], revealed: number, isActual: boolean) {
    const stroke = isActual ? 'var(--color-node-visited)' : 'var(--color-text-muted)'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isActual ? stroke : 'transparent',
              border: isActual ? 'none' : `1.5px dashed ${stroke}`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '9.5px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: stroke,
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
            }}
          >
            {isActual ? 'Actual' : 'Counterfactual'}
          </span>
          <span
            style={{
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
            }}
          >
            {label}
          </span>
        </div>

        <div
          style={{
            position: 'relative',
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            paddingBottom: '4px',
            minHeight: '76px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '2px',
              right: '2px',
              top: '38px',
              height: isActual ? '2px' : '1.5px',
              background: isActual ? stroke : undefined,
              backgroundImage: isActual
                ? undefined
                : `repeating-linear-gradient(to right, ${stroke} 0 6px, transparent 6px 10px)`,
              pointerEvents: 'none',
            }}
          />
          {revealed === 0 && (
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)', fontStyle: 'italic' }}>
              Tap below to trace this path…
            </span>
          )}
          {events.slice(0, revealed).map((ev, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                zIndex: 1,
                flex: '0 0 auto',
                width: '152px',
                background: 'var(--color-s2)',
                border: '1px solid var(--color-border-sub)',
                borderRadius: 'var(--radius-md)',
                padding: '9px 11px',
                animation: REVEAL,
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  color: stroke,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  marginBottom: '4px',
                }}
              >
                {ev.year}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', lineHeight: 1.45 }}>
                {ev.outcome}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '14px' }}>
        {/* Fork point — the shared root */}
        <div
          style={{
            flexShrink: 0,
            alignSelf: 'center',
            width: '136px',
            background: 'var(--color-s3)',
            border: '2px solid var(--color-ember)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            boxShadow: '0 0 0 4px var(--color-ember-glow)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          <span style={{ fontSize: '9px', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--color-ember)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
            The fork
          </span>
          <span style={{ fontSize: '15px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em' }}>
            {props.forkPoint.year}
          </span>
          <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', lineHeight: 1.45 }}>
            {props.forkPoint.description}
          </span>
        </div>

        {/* Diverging branches */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {renderBranch(actual.label, actual.events, aStep, true)}

          {actualDone ? (
            <div style={{ animation: REVEAL }}>{renderBranch(counter.label, counter.events, cStep, false)}</div>
          ) : (
            <div
              style={{
                border: '1.5px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                fontSize: '11.5px',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-sans)',
                fontStyle: 'italic',
              }}
            >
              The road not taken stays hidden until you finish tracing the actual path.
            </div>
          )}
        </div>
      </div>

      {/* Advance control */}
      {!allDone && (
        <button
          onClick={advance}
          style={{
            alignSelf: 'flex-start',
            background: 'var(--color-s3)',
            border: '1px solid var(--color-ember-dim)',
            borderRadius: 'var(--radius-sm)',
            padding: '7px 15px',
            fontSize: '12.5px',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          {buttonLabel()}
        </button>
      )}

      {/* The payoff */}
      {allDone && (
        <div
          style={{
            background: 'var(--color-ember-glow)',
            border: '1px solid var(--color-ember-dim)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            animation: REVEAL,
          }}
        >
          <div style={{ fontSize: '9.5px', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--color-ember)', fontFamily: 'var(--font-sans)', fontWeight: 600, marginBottom: '7px' }}>
            The insight
          </div>
          <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontFamily: 'var(--font-serif)', lineHeight: 1.58, fontStyle: 'italic' }}>
            {props.insight}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { BudgetAllocatorProps } from './schemas'

const REVEAL = 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both'

// Move slider `idx` to `raw`, then re-flow the OTHER categories so the whole
// allocation still sums to exactly 100. The delta is absorbed proportionally to
// each other category's current weight; scaling by a non-negative factor keeps
// every value clamped at ≥ 0 without a separate clamp pass.
function redistribute(guesses: number[], idx: number, raw: number): number[] {
  const newVal = Math.max(0, Math.min(100, raw))
  const remaining = 100 - newVal
  const othersSum = guesses.reduce((a, g, i) => (i === idx ? a : a + g), 0)
  return guesses.map((g, i) => {
    if (i === idx) return newVal
    if (othersSum <= 0) return remaining / (guesses.length - 1)
    return g * (remaining / othersSum)
  })
}

export function BudgetAllocator({ props }: { props: BudgetAllocatorProps }) {
  const { question, totalLabel, categories, insight } = props
  const n = categories.length
  const [guesses, setGuesses] = useState<number[]>(() => categories.map(() => 100 / n))
  const [revealed, setRevealed] = useState(false)
  const [uid] = useState(() => `ba-${Math.random().toString(36).slice(2, 8)}`)

  const css = `
    .${uid}-sl { -webkit-appearance: none; appearance: none; }
    .${uid}-sl::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: var(--slider-thumb-size); height: var(--slider-thumb-size);
      border-radius: 50%; background: var(--alloc-handle-bg);
      border: 1px solid var(--alloc-handle-border);
      box-shadow: var(--slider-thumb-glow);
      cursor: grab; transition: box-shadow .15s, transform .1s;
    }
    .${uid}-sl::-webkit-slider-thumb:active {
      cursor: grabbing; box-shadow: var(--slider-thumb-glow-active); transform: scale(1.1);
    }
    .${uid}-sl::-moz-range-thumb {
      width: var(--slider-thumb-size); height: var(--slider-thumb-size);
      border-radius: 50%; background: var(--alloc-handle-bg);
      border: 1px solid var(--alloc-handle-border);
      box-shadow: var(--slider-thumb-glow); cursor: grab;
    }
    @keyframes ${uid}-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  `

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* the question under examination */}
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 400,
        lineHeight: 1.4, letterSpacing: '-0.015em',
        color: 'var(--color-text-primary)', marginBottom: 14,
      }}>
        {question}
      </div>

      {/* total label + the running 100% (always balanced by construction) */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 16, paddingBottom: 10,
        borderBottom: '1px solid var(--color-border-sub)',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.09em',
          textTransform: 'uppercase', color: 'var(--color-text-muted)',
        }}>
          {totalLabel}
        </span>
        <span style={{
          fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500,
          color: revealed ? 'var(--color-node-settled)' : 'var(--color-ember)',
        }}>
          100%
        </span>
      </div>

      {/* one row per category */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: revealed ? 16 : 18 }}>
        {categories.map((cat, i) => {
          const guess = guesses[i]
          const gRound = Math.round(guess)

          if (!revealed) {
            const fill =
              `linear-gradient(to right, var(--alloc-fill) 0%, var(--alloc-fill) ${guess}%, ` +
              `var(--color-s4) ${guess}%, var(--color-s4) 100%)`
            return (
              <div key={cat.id}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-end', marginBottom: 8,
                }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{cat.label}</span>
                  <span style={{
                    fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500,
                    color: 'var(--color-ember)', letterSpacing: '-0.01em', lineHeight: 1,
                  }}>
                    {gRound}%
                  </span>
                </div>
                <input
                  className={`${uid}-sl`}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={guess}
                  onChange={e => setGuesses(prev => redistribute(prev, i, parseFloat(e.target.value)))}
                  style={{
                    width: '100%', height: 'var(--slider-track-height)', borderRadius: 2,
                    outline: 'none', display: 'block', cursor: 'pointer', background: fill,
                  }}
                />
              </div>
            )
          }

          // revealed: actual bar grows in; guess marker + delta show the gap
          const actual = cat.actualPercent
          const dRound = Math.round(actual - guess)
          const exact = dRound === 0
          const over = dRound < 0 // guessed too high
          const deltaColor = exact
            ? 'var(--color-text-muted)'
            : over
              ? 'var(--alloc-delta-over)'
              : 'var(--alloc-delta-under)'
          const deltaText = exact
            ? 'spot on'
            : `${over ? '−' : '+'}${Math.abs(dRound)} pts ${over ? 'less' : 'more'} than you guessed`

          return (
            <div key={cat.id} style={{ animation: REVEAL }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', marginBottom: 7,
              }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>{cat.label}</span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: deltaColor }}>{deltaText}</span>
              </div>

              <div style={{
                position: 'relative', height: 10, background: 'var(--color-s4)',
                borderRadius: 'var(--bar-radius)', overflow: 'hidden',
              }}>
                {/* actual share — animates out from the left edge */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${actual}%`, background: 'var(--alloc-actual-fill)',
                  borderRadius: 'var(--bar-radius)', transformOrigin: 'left',
                  animation: `${uid}-grow 600ms cubic-bezier(0.22,1,0.36,1) both`,
                }} />
                {/* where you guessed */}
                <div style={{
                  position: 'absolute', left: `${guess}%`, top: -2, bottom: -2,
                  width: 2, transform: 'translateX(-1px)',
                  background: 'var(--color-ember)',
                }} />
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 5, fontSize: 10.5, color: 'var(--color-text-muted)',
              }}>
                <span>You guessed {gRound}%</span>
                <span style={{ color: 'var(--color-node-settled)' }}>Actually {Math.round(actual)}%</span>
              </div>

              {cat.hint && (
                <div style={{
                  marginTop: 6, fontSize: 11.5, fontWeight: 300,
                  lineHeight: 1.45, color: 'var(--color-text-secondary)',
                }}>
                  {cat.hint}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          style={{
            marginTop: 22, width: '100%', padding: '11px 16px',
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--color-ground)',
            background: 'var(--color-ember)', border: 'none',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          }}
        >
          See reality
        </button>
      ) : (
        <div style={{
          animation: REVEAL, marginTop: 20, background: 'var(--color-s1)',
          border: '1px solid var(--color-border-sub)', borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
        }}>
          <span style={{
            display: 'block', fontSize: 10, fontWeight: 500, letterSpacing: '0.09em',
            textTransform: 'uppercase', color: 'var(--color-ember-dim)', marginBottom: 6,
          }}>
            The pattern
          </span>
          <p style={{
            fontFamily: 'var(--font-serif)', fontSize: 13.5, fontStyle: 'italic',
            fontWeight: 300, color: 'var(--color-text-primary)', lineHeight: 1.58, margin: 0,
          }}>
            {insight}
          </p>
        </div>
      )}
    </div>
  )
}

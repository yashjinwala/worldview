'use client'

import { useState, useMemo } from 'react'
import { SliderSimProps } from './schemas'

const SEV_COLORS = [
  'var(--color-sev-safe)',
  'var(--color-sev-warn)',
  'var(--color-sev-caution)',
  'var(--color-sev-danger)',
  'var(--color-sev-crisis)',
]

function countDecimals(n: number): number {
  const s = n.toString()
  const dot = s.indexOf('.')
  return dot === -1 ? 0 : s.length - dot - 1
}

export function SliderSim({ props }: { props: SliderSimProps }) {
  const { variable, outcomes, referenceLines } = props
  const [value, setValue] = useState(variable.initial)
  const [uid] = useState(() => `ss-${Math.random().toString(36).slice(2, 8)}`)

  const segIdx = useMemo(() => {
    const i = outcomes.findIndex(o => o.atOrBelow >= value)
    return i === -1 ? outcomes.length - 1 : i
  }, [value, outcomes])

  const n = outcomes.length
  const sevIdx = Math.min(4, Math.round((segIdx / Math.max(n - 1, 1)) * 4))
  const sevColor = SEV_COLORS[sevIdx] ?? 'var(--color-sev-safe)'
  const outcome = outcomes[segIdx] ?? outcomes[outcomes.length - 1]

  const dp = useMemo(() => countDecimals(variable.step), [variable.step])
  const pct = ((value - variable.min) / (variable.max - variable.min)) * 100
  const trackBg = `linear-gradient(to right, ${sevColor} 0%, ${sevColor} ${pct}%, var(--color-s4) ${pct}%, var(--color-s4) 100%)`

  const thumbCss = `
    #${uid} { -webkit-appearance: none; appearance: none; }
    #${uid}::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--color-ember);
      box-shadow: 0 0 10px var(--color-ember-hot);
      cursor: grab;
      transition: box-shadow 0.15s, transform 0.1s;
    }
    #${uid}::-webkit-slider-thumb:active {
      cursor: grabbing;
      box-shadow: 0 0 18px var(--color-ember-hot);
      transform: scale(1.1);
    }
    #${uid}::-moz-range-thumb {
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--color-ember); border: none;
      box-shadow: 0 0 10px var(--color-ember-hot);
      cursor: grab;
    }
  `

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {/* thumb pseudo-element styles scoped to this instance */}
      <style dangerouslySetInnerHTML={{ __html: thumbCss }} />

      {/* ── Slider section ── */}
      <div style={{ marginBottom: 18 }}>
        {/* top row: label left, value right */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-end', marginBottom: 11,
        }}>
          <span style={{
            fontSize: 12, color: 'var(--color-text-secondary)',
            fontWeight: 400, lineHeight: 1.2,
          }}>
            {variable.label}
          </span>
          <span style={{
            fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 500,
            color: 'var(--color-ember)', lineHeight: 1,
            letterSpacing: '-0.02em', transition: 'color 0.25s',
          }}>
            {value.toFixed(dp)}{variable.unit}
          </span>
        </div>

        {/* track wrapper — hosts range input + reference-line ticks */}
        <div style={{ position: 'relative' }}>
          <input
            id={uid}
            type="range"
            min={variable.min}
            max={variable.max}
            step={variable.step}
            value={value}
            onChange={e => setValue(parseFloat(e.target.value))}
            style={{
              width: '100%', height: 4, borderRadius: 2,
              outline: 'none', cursor: 'pointer',
              background: trackBg, display: 'block',
            }}
          />

          {/* reference-line ticks */}
          {referenceLines?.map((ref, i) => {
            const lp = ((ref.value - variable.min) / (variable.max - variable.min)) * 100
            return (
              <div
                key={i}
                style={{
                  position: 'absolute', left: `${lp}%`, top: -4,
                  transform: 'translateX(-50%)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', pointerEvents: 'none', gap: '3px',
                }}
              >
                <div style={{
                  width: 1, height: 12,
                  background: 'var(--color-text-ghost)',
                }} />
                <span style={{
                  fontSize: 9, color: 'var(--color-text-muted)',
                  whiteSpace: 'nowrap', letterSpacing: '0.01em',
                }}>
                  {ref.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* extreme labels */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 6, fontSize: 10, color: 'var(--color-text-ghost)',
        }}>
          <span>{variable.min}{variable.unit}</span>
          <span>{variable.max}{variable.unit}</span>
        </div>
      </div>

      {/* ── Outcome output ── */}
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 400,
        color: sevColor, lineHeight: 1.35,
        marginBottom: 6, minHeight: 44,
        transition: 'color 0.3s', letterSpacing: '-0.015em',
      }}>
        {outcome.headline}
      </div>
      <div style={{
        fontSize: 12.5, color: 'var(--color-text-secondary)',
        fontWeight: 300, lineHeight: 1.55, minHeight: 38,
      }}>
        {outcome.detail}
      </div>
    </div>
  )
}

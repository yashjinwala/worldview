'use client'

import { useState } from 'react'
import { OddsCalibratorProps } from './schemas'

export function OddsCalibrator({ props }: { props: OddsCalibratorProps }) {
  const { claim, isTrue, reveal, calibrationNote } = props
  const [confidence, setConfidence] = useState(50)
  const [revealed, setRevealed] = useState(false)
  const [uid] = useState(() => `oc-${Math.random().toString(36).slice(2, 8)}`)

  const overConfident = revealed && !isTrue && confidence > 70
  const underConfident = revealed && isTrue && confidence < 30

  const fillColor = overConfident
    ? 'var(--confidence-over-fill)'
    : underConfident
      ? 'var(--confidence-under-fill)'
      : 'var(--color-ember)'

  const trackBg =
    `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${confidence}%, ` +
    `var(--color-s4) ${confidence}%, var(--color-s4) 100%)`

  const verdictColor = isTrue ? 'var(--color-node-settled)' : 'var(--color-sev-danger)'

  const thumbCss = `
    #${uid} { -webkit-appearance: none; appearance: none; }
    #${uid}::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: var(--slider-thumb-size); height: var(--slider-thumb-size);
      border-radius: 50%; background: var(--slider-thumb-bg);
      box-shadow: var(--slider-thumb-glow);
      cursor: grab; transition: box-shadow 0.15s, transform 0.1s;
    }
    #${uid}::-webkit-slider-thumb:active {
      cursor: grabbing; box-shadow: var(--slider-thumb-glow-active); transform: scale(1.1);
    }
    #${uid}:disabled::-webkit-slider-thumb { cursor: default; }
    #${uid}::-moz-range-thumb {
      width: var(--slider-thumb-size); height: var(--slider-thumb-size);
      border-radius: 50%; background: var(--slider-thumb-bg); border: none;
      box-shadow: var(--slider-thumb-glow); cursor: grab;
    }
  `

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      <style dangerouslySetInnerHTML={{ __html: thumbCss }} />

      {/* the claim under test */}
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 400,
        lineHeight: 1.4, letterSpacing: '-0.015em',
        color: 'var(--color-text-primary)', marginBottom: 22,
      }}>
        {claim}
      </div>

      {/* label + live readout */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-end', marginBottom: 11,
      }}>
        <span style={{ fontSize: 12, color: 'var(--confidence-label)', fontWeight: 400 }}>
          How confident are you this is TRUE?
        </span>
        <span style={{
          fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 500,
          lineHeight: 1, letterSpacing: '-0.02em', color: fillColor,
          transition: 'color 0.25s',
        }}>
          {confidence}%
        </span>
      </div>

      <input
        id={uid}
        type="range"
        min={0}
        max={100}
        step={1}
        value={confidence}
        disabled={revealed}
        onChange={e => setConfidence(parseInt(e.target.value, 10))}
        style={{
          width: '100%', height: 'var(--slider-track-height)', borderRadius: 2,
          outline: 'none', display: 'block',
          cursor: revealed ? 'default' : 'pointer', background: trackBg,
        }}
      />

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 6, fontSize: 10, color: 'var(--color-text-ghost)',
      }}>
        <span>0% · FALSE</span>
        <span>TRUE · 100%</span>
      </div>

      {!revealed && (
        <button
          onClick={() => setRevealed(true)}
          style={{
            marginTop: 20, width: '100%', padding: '11px 16px',
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
            letterSpacing: '0.02em', color: 'var(--color-ground)',
            background: 'var(--color-ember)', border: 'none',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          }}
        >
          Reveal
        </button>
      )}

      {revealed && (
        <div style={{
          animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both',
          marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 500,
            letterSpacing: '-0.02em', color: verdictColor,
          }}>
            Actually: {isTrue ? 'TRUE' : 'FALSE'}
          </div>

          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.6,
            color: 'var(--color-text-primary)', margin: 0,
          }}>
            {reveal}
          </p>

          {(overConfident || underConfident) && (
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 400,
              lineHeight: 1.5, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              color: overConfident ? 'var(--feedback-incorrect-text)' : 'var(--color-node-visited)',
              background: overConfident ? 'var(--confidence-over-fill)' : 'var(--confidence-under-fill)',
            }}>
              {overConfident
                ? 'You were in the overconfident zone — high certainty on a false claim.'
                : 'You were in the underconfident zone — low certainty on a true claim.'}
            </div>
          )}

          <div>
            <span style={{
              display: 'block', fontFamily: 'var(--font-sans)', fontSize: 10,
              fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase',
              color: 'var(--color-ember-dim)', marginBottom: 6,
            }}>
              Calibration
            </span>
            <p style={{
              fontFamily: 'var(--font-sans)', fontSize: 13.5, lineHeight: 1.5,
              color: 'var(--color-text-muted)', margin: 0,
            }}>
              {calibrationNote}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

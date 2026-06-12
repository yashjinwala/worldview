'use client'

import { useState, useMemo } from 'react'
import { ThresholdHuntProps } from './schemas'

const MAX_PROBES = 6

// Coarse, human-friendly slider step derived from the range (~40 stops, snapped to 1/2/5).
function niceStep(range: number): number {
  if (!(range > 0)) return 1
  const rough = range / 40
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return nice * mag
}

type Side = 'below' | 'above' | 'close'

export function ThresholdHunt({ props }: { props: ThresholdHuntProps }) {
  const {
    question, unit, minValue, maxValue, thresholdValue,
    belowLabel, aboveLabel, revealTolerance, reveal,
  } = props

  const step = useMemo(() => niceStep(maxValue - minValue), [minValue, maxValue])
  const dp = useMemo(() => {
    const i = step.toString().indexOf('.')
    return i === -1 ? 0 : step.toString().length - i - 1
  }, [step])

  const [probe, setProbe] = useState(() => parseFloat(((minValue + maxValue) / 2).toFixed(dp)))
  const [tests, setTests] = useState<{ value: number; side: Side }[]>([])
  const [revealed, setRevealed] = useState(false)
  const [uid] = useState(() => `th-${Math.random().toString(36).slice(2, 8)}`)

  const probeCount = tests.length
  const done = revealed || probeCount >= MAX_PROBES
  const last = tests[probeCount - 1]

  const fmt = (n: number) => `${n.toFixed(dp)}${unit}`
  const pos = (v: number) => ((v - minValue) / (maxValue - minValue)) * 100
  const probePct = pos(probe)
  const thresholdPct = pos(thresholdValue)

  function runTest() {
    if (done) return
    const diff = Math.abs(probe - thresholdValue)
    const side: Side = diff <= revealTolerance ? 'close' : probe < thresholdValue ? 'below' : 'above'
    setTests(t => [...t, { value: probe, side }])
  }

  const trackBg =
    `linear-gradient(to right, var(--color-ember-dim) 0%, var(--color-ember-dim) ${probePct}%, ` +
    `var(--color-s4) ${probePct}%, var(--color-s4) 100%)`

  const thumbCss = `
    #${uid} { -webkit-appearance: none; appearance: none; }
    #${uid}::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: var(--slider-thumb-size); height: var(--slider-thumb-size);
      border-radius: 50%; background: var(--slider-thumb-bg);
      box-shadow: var(--slider-thumb-glow); cursor: grab;
      transition: box-shadow 0.15s, transform 0.1s;
    }
    #${uid}::-webkit-slider-thumb:active {
      cursor: grabbing; box-shadow: var(--slider-thumb-glow-active); transform: scale(1.1);
    }
    #${uid}::-moz-range-thumb {
      width: var(--slider-thumb-size); height: var(--slider-thumb-size);
      border-radius: 50%; background: var(--slider-thumb-bg); border: none;
      box-shadow: var(--slider-thumb-glow); cursor: grab;
    }
  `

  const emberBtn: React.CSSProperties = {
    width: '100%', padding: '11px 16px', fontFamily: 'var(--font-sans)',
    fontSize: 13, fontWeight: 500, letterSpacing: '0.02em', color: 'var(--color-ground)',
    background: 'var(--color-ember)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  }

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      <style dangerouslySetInnerHTML={{ __html: thumbCss }} />

      {/* the question under hunt */}
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 400, lineHeight: 1.4,
        letterSpacing: '-0.015em', color: 'var(--color-text-primary)', marginBottom: 18,
      }}>
        {question}
      </div>

      {!done && (
        <>
          {/* probe counter + live readout */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 11 }}>
            <span style={{
              fontSize: 10, fontWeight: 500, letterSpacing: '0.09em',
              textTransform: 'uppercase', color: 'var(--color-text-muted)',
            }}>
              Probe {probeCount + 1} of {MAX_PROBES}
            </span>
            <span style={{
              fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 500,
              lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--color-ember)',
            }}>
              {fmt(probe)}
            </span>
          </div>

          <input
            id={uid}
            type="range"
            min={minValue}
            max={maxValue}
            step={step}
            value={probe}
            onChange={e => setProbe(parseFloat(e.target.value))}
            style={{
              width: '100%', height: 'var(--slider-track-height)', borderRadius: 2,
              outline: 'none', display: 'block', cursor: 'pointer', background: trackBg,
            }}
          />

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 6, fontSize: 10, color: 'var(--color-text-ghost)',
          }}>
            <span>{fmt(minValue)}</span>
            <span>{fmt(maxValue)}</span>
          </div>

          <button onClick={runTest} style={{ ...emberBtn, marginTop: 18 }}>
            Test this value
          </button>

          {/* feedback for the most recent probe — threshold itself stays hidden */}
          {last && (last.side === 'close' ? (
            <div style={{
              marginTop: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-ember-glow)', border: '1px solid var(--color-ember-dim)',
            }}>
              <div style={{
                fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500,
                color: 'var(--color-ember)', marginBottom: 10,
              }}>
                {fmt(last.value)} is close enough — reveal?
              </div>
              <button onClick={() => setRevealed(true)} style={emberBtn}>
                Reveal the threshold
              </button>
            </div>
          ) : (
            <div style={{
              marginTop: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)',
              background: last.side === 'below' ? 'var(--threshold-below-bg)' : 'var(--threshold-above-bg)',
              border: `1px solid ${last.side === 'below' ? 'rgba(61,122,82,0.30)' : 'rgba(88,120,158,0.30)'}`,
            }}>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 500, letterSpacing: '0.02em',
                color: last.side === 'below' ? 'var(--color-node-settled)' : 'var(--color-node-visited)',
                marginBottom: 4,
              }}>
                {fmt(last.value)} is {last.side} the threshold
              </div>
              <div style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
                {last.side === 'below' ? belowLabel : aboveLabel}
              </div>
            </div>
          ))}
        </>
      )}

      {done && (
        <div style={{ animation: 'worldview-reveal 300ms cubic-bezier(0.22,1,0.36,1) both' }}>
          {/* range bounds */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginBottom: 6, fontSize: 10, color: 'var(--color-text-ghost)',
          }}>
            <span>{fmt(minValue)}</span>
            <span>{fmt(maxValue)}</span>
          </div>

          {/* labeled range bar: tinted below/above zones + revealed threshold marker */}
          <div style={{
            position: 'relative', height: 38, borderRadius: 'var(--radius-sm)',
            overflow: 'hidden', background: 'var(--color-s4)',
          }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${thresholdPct}%`, background: 'var(--threshold-below-bg)' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - thresholdPct}%`, background: 'var(--threshold-above-bg)' }} />
            {tests.map((t, i) => (
              <div key={i} style={{
                position: 'absolute', left: `${pos(t.value)}%`, top: '50%',
                transform: 'translate(-50%,-50%)', width: 2, height: 10,
                background: 'var(--color-text-ghost)', borderRadius: 1,
              }} />
            ))}
            <div style={{
              position: 'absolute', left: `${thresholdPct}%`, top: 0, bottom: 0, width: 2,
              transform: 'translateX(-1px)', background: 'var(--color-ember)',
              boxShadow: '0 0 10px var(--color-ember-hot)',
            }} />
          </div>

          {/* revealed threshold value, pinned to the marker */}
          <div style={{ position: 'relative', height: 20, marginTop: 5 }}>
            <span style={{
              position: 'absolute', left: `${thresholdPct}%`, transform: 'translateX(-50%)',
              fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500,
              color: 'var(--color-ember)', whiteSpace: 'nowrap',
            }}>
              {fmt(thresholdValue)}
            </span>
          </div>

          {/* zone labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase',
                color: 'var(--color-node-settled)', marginBottom: 3,
              }}>
                Below
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 300, lineHeight: 1.45, color: 'var(--color-text-secondary)' }}>
                {belowLabel}
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{
                fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase',
                color: 'var(--color-node-visited)', marginBottom: 3,
              }}>
                Above
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 300, lineHeight: 1.45, color: 'var(--color-text-secondary)' }}>
                {aboveLabel}
              </div>
            </div>
          </div>

          <p style={{
            margin: '18px 0 0', fontFamily: 'var(--font-sans)', fontSize: 14,
            lineHeight: 1.6, color: 'var(--color-text-primary)',
          }}>
            {reveal}
          </p>

          <div style={{
            marginTop: 12, fontSize: 10, fontWeight: 500, letterSpacing: '0.09em',
            textTransform: 'uppercase', color: 'var(--color-text-muted)',
          }}>
            {probeCount} {probeCount === 1 ? 'probe' : 'probes'} used
          </div>
        </div>
      )}
    </div>
  )
}

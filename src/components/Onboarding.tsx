'use client'
// Onboarding (TDD §5.1): one prompt, four posture chips, a question, then a
// sharpen-and-confirm line. Challenge captures a starting position; surprise-me skips
// the question entirely.

import { useState } from 'react'
import { onboard } from '@/lib/client'

const POSTURES: Array<{ id: string; label: string }> = [
  { id: 'understand', label: 'understand something confusing' },
  { id: 'challenge', label: 'challenge a belief I hold' },
  { id: 'deep-dive', label: 'go deep on an obsession' },
  { id: 'surprise-me', label: 'surprise me' },
]

export default function Onboarding({
  userId,
  onStart,
  onCancel,
}: {
  userId: string
  onStart: (info: { mapId: string; sessionId: string; kickoff: { message: string; viaShelf: boolean } }) => void
  onCancel?: () => void
}) {
  const [posture, setPosture] = useState('understand')
  const [question, setQuestion] = useState('')
  const [position, setPosition] = useState('')
  const [phase, setPhase] = useState<'compose' | 'confirm' | 'loading'>('compose')
  const [sharpened, setSharpened] = useState('')
  const [result, setResult] = useState<{ mapId: string; sessionId: string } | null>(null)

  const surprise = posture === 'surprise-me'

  const submit = async () => {
    setPhase('loading')
    const res = await onboard({
      userId,
      posture,
      rawQuestion: surprise ? undefined : question,
      startingPosition: posture === 'challenge' ? position : undefined,
    })
    setResult({ mapId: res.mapId, sessionId: res.sessionId })
    if (surprise) {
      onStart({ mapId: res.mapId, sessionId: res.sessionId, kickoff: { message: res.sharpenedQuestion, viaShelf: false } })
    } else {
      setSharpened(res.sharpenedQuestion)
      setPhase('confirm')
    }
  }

  const confirm = async () => {
    if (!result) return
    setPhase('loading')
    // The user's final text is what's stored — retitle if they edited the sharpened question.
    await fetch(`/api/map/${result.mapId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heldQuestion: sharpened }),
    }).catch(() => {})
    onStart({ mapId: result.mapId, sessionId: result.sessionId, kickoff: { message: sharpened, viaShelf: false } })
  }

  return (
    <div className="wv-screen">
      <div className="wv-onboard-card">
        <div className="wv-onboard-logo">Worldview</div>

        {phase === 'confirm' ? (
          <>
            <div className="wv-onboard-prompt">So the question is —</div>
            <div className="wv-sharpen-card">
              <div className="wv-sharpen-label">edit it if it&rsquo;s not quite right</div>
              <input className="wv-sharpen-input" value={sharpened} onChange={(e) => setSharpened(e.target.value)} autoFocus />
              <div className="wv-row" style={{ marginTop: 16 }}>
                <button className="wv-btn-primary" onClick={confirm} disabled={!sharpened.trim()}>Yes, let&rsquo;s go</button>
                <button className="wv-btn-ghost" onClick={() => setPhase('compose')}>Back</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="wv-onboard-prompt">What brought you here today?</div>
            <div className="wv-chips">
              {POSTURES.map((p) => (
                <button
                  key={p.id}
                  className={`wv-posture-chip${posture === p.id ? ' active' : ''}`}
                  onClick={() => setPosture(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {!surprise && (
              <textarea
                className="wv-textarea"
                placeholder="the thing you can't stop wondering about…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            )}
            {posture === 'challenge' && (
              <textarea
                className="wv-textarea"
                style={{ marginTop: 10, minHeight: 56 }}
                placeholder="and what do you think right now? (one line)"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            )}
            <div className="wv-row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
              <button
                className="wv-btn-primary"
                onClick={submit}
                disabled={phase === 'loading' || (!surprise && !question.trim())}
              >
                {phase === 'loading' ? <span className="wv-spinner" /> : 'Begin'}
              </button>
              {onCancel && <button className="wv-btn-ghost" onClick={onCancel}>Back to shelf</button>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

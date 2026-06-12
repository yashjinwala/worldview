'use client'
// The map shelf (TDD §9). One card per map — each a hook, not a menu item: it names
// the brightest still-open loop outright, shows the glow count and where you stand.
// After the 3rd session a card gains a "your guide has noticed" line. Export/Import
// guards the everything-lives-in-this-browser risk.

import { useEffect, useRef, useState } from 'react'
import { fetchMaps, getUserId, setUserId } from '@/lib/client'

interface Card {
  mapId: string
  heldQuestion: string
  posture: string
  openLoopCount: number
  brightestOpenLoop: string | null
  currentView: string | null
  lastVisitedAt: string
  lastSessionId: string | null
}

export default function Shelf({
  userId,
  onOpen,
  onNew,
}: {
  userId: string
  onOpen: (mapId: string, lastSessionId: string | null) => void
  onNew: () => void
}) {
  const [cards, setCards] = useState<Card[]>([])
  const [styleNote, setStyleNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchMaps(userId)
      .then((d) => {
        setCards(d.maps)
        setStyleNote(d.styleNote)
      })
      .finally(() => setLoading(false))
  }, [userId])

  const exportData = () => {
    window.location.href = `/api/export?userId=${encodeURIComponent(userId)}`
  }

  const importData = async (file: File) => {
    const text = await file.text()
    const bundle = JSON.parse(text)
    const res = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text })
    if (res.ok) {
      const data = await res.json()
      if (data.userId) setUserId(data.userId)
      window.location.reload()
    }
    void bundle
  }

  if (loading) return <div className="wv-screen"><span className="wv-spinner" /></div>

  return (
    <div className="wv-screen">
      <div className="wv-shelf">
        <div className="wv-shelf-head">
          <div className="wv-shelf-title">Your maps</div>
          <button className="wv-btn-primary" onClick={onNew}>Bring a new question</button>
        </div>

        <div className="wv-shelf-grid">
          {cards.map((c) => (
            <div key={c.mapId} className="wv-shelf-card" onClick={() => onOpen(c.mapId, c.lastSessionId)}>
              <div className="wv-shelf-q">{c.heldQuestion}</div>
              {c.brightestOpenLoop && <div className="wv-shelf-open">Still open: {c.brightestOpenLoop}</div>}
              <div className="wv-shelf-meta">
                <span className="wv-glow-dot" />
                {c.openLoopCount} {c.openLoopCount === 1 ? 'loop glows' : 'loops glow'}
                <span className="sep">·</span>
                {new Date(c.lastVisitedAt).toLocaleDateString()}
              </div>
              {c.currentView && <div className="wv-shelf-stand">Where you stand: {c.currentView}</div>}
              {styleNote && <div className="wv-shelf-noticed">Your guide has noticed: {styleNote}</div>}
            </div>
          ))}
          {cards.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              No maps yet — bring a question you can&rsquo;t stop wondering about.
            </p>
          )}
        </div>

        <div className="wv-shelf-footer">
          <button className="wv-btn-ghost" onClick={exportData}>Export</button>
          <button className="wv-btn-ghost" onClick={() => fileRef.current?.click()}>Import</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
          />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Your maps are keyed to this browser. Export to keep a copy you control.
          </span>
        </div>
      </div>
    </div>
  )
}

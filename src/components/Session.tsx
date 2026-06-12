'use client'
// The session view (TDD §9): header · chat (left) · map (right) · Conductor drawer.
// Drives the per-turn loop, streams the Tutor, upserts the map, and renders artifacts.

import { useCallback, useEffect, useRef, useState } from 'react'
import MapPane, { WvNode } from './MapPane'
import ConductorPane, { ConductorRow } from './ConductorPane'
import { ArtifactCard } from '@/templates'
import { streamTurn, endSession, endSessionBeacon, fetchMap, softCloseLoop, disputeReader, setActiveSession } from '@/lib/client'

type FeedItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'guide'; id: string; text: string; turn: number; streaming: boolean }
  | { kind: 'artifact'; id: string; templateId: string; props: Record<string, unknown> }
  | { kind: 'safety'; id: string; text: string }

interface ViewState {
  currentView: string | null
  startingPosition: string | null
  snapshots: Array<{ id: string; content: string; createdAt: string }>
  asOf: string | null
}

let _id = 0
const nid = () => `f${_id++}`

export default function Session({
  mapId,
  sessionId: initialSessionId,
  kickoff,
  onExit,
}: {
  mapId: string
  sessionId: string
  kickoff: { message: string; viaShelf: boolean } | null
  onExit: () => void
}) {
  const [sessionId, setSessionId] = useState(initialSessionId)
  const sessionRef = useRef(initialSessionId)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [nodes, setNodes] = useState<WvNode[]>([])
  const [rows, setRows] = useState<ConductorRow[]>([])
  const [cost, setCost] = useState(0)
  const [costLocked, setCostLocked] = useState(false)
  const [heldQuestion, setHeldQuestion] = useState('')
  const [view, setView] = useState<ViewState>({ currentView: null, startingPosition: null, snapshots: [], asOf: null })
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [condCollapsed, setCondCollapsed] = useState(false)
  const [editingView, setEditingView] = useState(false)
  const [editText, setEditText] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const queue = useRef<Array<{ message: string; viaShelf?: boolean; viaNodeClick?: boolean }>>([])
  const messagesRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  const setSession = (id: string) => {
    sessionRef.current = id
    setSessionId(id)
  }

  const upsertNodes = useCallback((incoming: WvNode[]) => {
    setNodes((prev) => {
      const map = new Map(prev.map((n) => [n.id, n]))
      for (const n of incoming) map.set(n.id, { ...map.get(n.id), ...n })
      return Array.from(map.values())
    })
  }, [])

  const loadSnapshot = useCallback(async () => {
    try {
      const snap = await fetchMap(mapId)
      setHeldQuestion(snap.map.heldQuestion)
      upsertNodes(snap.nodes)
      setView({
        currentView: snap.map.currentView,
        startingPosition: snap.map.startingPosition,
        snapshots: snap.viewSnapshots ?? [],
        asOf: snap.viewSnapshots?.[0]?.createdAt ?? null,
      })
    } catch {
      /* map not ready yet */
    }
  }, [mapId, upsertNodes])

  // ── the turn loop ──────────────────────────────────────────────────────────
  const runTurn = useCallback(
    async (message: string, opts: { viaShelf?: boolean; viaNodeClick?: boolean; renderUser?: boolean } = {}) => {
      setBusy(true)
      if (opts.renderUser !== false) setFeed((f) => [...f, { kind: 'user', id: nid(), text: message }])
      const guideId = nid()
      let turnNum = rows.length + 1
      setFeed((f) => [...f, { kind: 'guide', id: guideId, text: '', turn: turnNum, streaming: true }])

      await streamTurn(
        { sessionId: sessionRef.current, message, viaShelf: opts.viaShelf, viaNodeClick: opts.viaNodeClick },
        {
          onEvent: (ev) => {
            const d = ev.data as Record<string, unknown>
            switch (ev.type) {
              case 'director_decision': {
                turnNum = (d.turn as number) ?? turnNum
                setRows((r) => [
                  ...r,
                  {
                    turn: d.turn as number,
                    decisionId: d.decisionId as string,
                    signals: d.signals as ConductorRow['signals'],
                    tools: d.tools as ConductorRow['tools'],
                    rationale: d.rationale as string,
                  },
                ])
                setFeed((f) => f.map((it) => (it.id === guideId && it.kind === 'guide' ? { ...it, turn: d.turn as number } : it)))
                break
              }
              case 'tutor_delta':
                setFeed((f) =>
                  f.map((it) => (it.id === guideId && it.kind === 'guide' ? { ...it, text: it.text + (d.text as string) } : it))
                )
                break
              case 'map_update':
                upsertNodes(d.nodes as WvNode[])
                break
              case 'artifact_ready': {
                const a = d.artifact as { id: string; templateId: string; props: Record<string, unknown> }
                setFeed((f) => [...f, { kind: 'artifact', id: a.id, templateId: a.templateId, props: a.props }])
                break
              }
              case 'safety_note':
                setFeed((f) => [...f, { kind: 'safety', id: nid(), text: d.text as string }])
                break
              case 'cost':
                setCost((d.sessionTotalUsd as number) ?? 0)
                break
              case 'done':
                if (d.sessionId && d.sessionId !== sessionRef.current) setSession(d.sessionId as string)
                break
              case 'error':
                void loadSnapshot()
                break
            }
          },
        }
      )

      setFeed((f) => f.map((it) => (it.id === guideId && it.kind === 'guide' ? { ...it, streaming: false } : it)))
      await loadSnapshot()
      // cost lock detection: refetch handled in loadSnapshot via map? costLocked comes from cost ceiling
      setBusy(false)
      const next = queue.current.shift()
      if (next) void runTurn(next.message, next)
    },
    [rows.length, upsertNodes, loadSnapshot]
  )

  // Detect cost lock: when cost crosses the ceiling, the next turn streams the wrap-up
  // and the session is locked. We surface the lock from the session state via a light poll
  // on cost; simplest: read costLocked from the map snapshot's latest session is overkill —
  // instead the ceiling wrap-up sets it; we infer from cost >= limit after a turn.
  useEffect(() => {
    if (cost >= 2.0) setCostLocked(true)
  }, [cost])

  const send = useCallback(
    (message: string, opts: { viaNodeClick?: boolean } = {}) => {
      const text = message.trim()
      if (!text || costLocked) return
      if (busy) {
        queue.current.push({ message: text, ...opts })
        return
      }
      void runTurn(text, opts)
    },
    [busy, costLocked, runTurn]
  )

  // Mount: load the map, rehydrate the recent conversation so a reload doesn't read as
  // "the product forgot me" (§4 disconnect path), then fire the kickoff turn once.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const snap = await fetchMap(mapId).catch(() => null)
      if (!cancelled && snap) {
        setHeldQuestion(snap.map.heldQuestion)
        upsertNodes(snap.nodes)
        setView({
          currentView: snap.map.currentView,
          startingPosition: snap.map.startingPosition,
          snapshots: snap.viewSnapshots ?? [],
          asOf: snap.viewSnapshots?.[0]?.createdAt ?? null,
        })
        setCost(snap.latestSessionCost ?? 0)
        const recent = (snap.recentMessages ?? []) as Array<{ role: string; content: string }>
        if (recent.length) {
          let t = 0
          const items: FeedItem[] = recent.map((m) =>
            m.role === 'assistant'
              ? { kind: 'guide', id: nid(), text: m.content, turn: ++t, streaming: false }
              : { kind: 'user', id: nid(), text: m.content }
          )
          for (const a of (snap.artifacts ?? []) as Array<{ id: string; templateId: string; props: Record<string, unknown> }>) {
            items.push({ kind: 'artifact', id: a.id, templateId: a.templateId, props: a.props })
          }
          setFeed(items)
          const decisions = (snap.recentDecisions ?? []) as Array<{
            id: string
            turn: number
            signals: ConductorRow['signals']
            tools: ConductorRow['tools']
            rationale: string
          }>
          setRows(
            decisions.map((d) => ({
              turn: d.turn,
              decisionId: d.id,
              signals: d.signals,
              tools: d.tools,
              rationale: d.rationale,
            }))
          )
          // Pure resume (no kickoff) → adopt the latest session as the working one.
          if (!kickoff && snap.latestSessionId) setSession(snap.latestSessionId)
        }
      }
      if (!cancelled && !startedRef.current && kickoff) {
        startedRef.current = true
        void runTurn(kickoff.message, { viaShelf: kickoff.viaShelf, renderUser: true })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the active-session marker fresh so a page reload resumes here.
  useEffect(() => {
    setActiveSession({ mapId, sessionId })
  }, [mapId, sessionId])

  // Persist on tab close (beacon).
  useEffect(() => {
    const handler = () => endSessionBeacon(sessionRef.current)
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Scroll chat to bottom on new content.
  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [feed])

  const onPull = useCallback((n: WvNode) => send(`Let's pull on this thread: ${n.title}`, { viaNodeClick: true }), [send])
  const onSoftClose = useCallback(
    async (loopId: string) => {
      await softCloseLoop(loopId, sessionRef.current)
      await loadSnapshot()
    },
    [loadSnapshot]
  )
  const onDispute = useCallback((decisionId: string, vote: 'up' | 'down') => disputeReader(sessionRef.current, decisionId, vote), [])

  const startFresh = async () => {
    await endSession(sessionRef.current)
    setFeed([])
    setRows([])
    setCost(0)
    setCostLocked(false)
    queue.current = []
    startedRef.current = true
    await runTurn("I'm back — let's keep going.", { viaShelf: true, renderUser: true })
  }

  const saveView = async () => {
    const content = editText.trim()
    if (content) {
      await fetch(`/api/map/${mapId}/view`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) })
      await loadSnapshot()
    }
    setEditingView(false)
  }

  const open = nodes.filter((n) => n.hasOpenLoop).length
  const closed = nodes.filter((n) => n.status === 'settled').length
  const costClass = costLocked ? 'locked' : cost >= 1.6 ? 'near' : ''

  return (
    <>
      <div className="wv-header">
        <button className="wv-logo" onClick={() => { setActiveSession(null); onExit() }}>Worldview</button>
        <div className="wv-hdiv" />
        <span className="wv-session-title">{heldQuestion}</span>
        {view.currentView && (
          <div className="wv-stand">
            <span className="wv-stand-label">Where you stand</span>
            <span className="wv-stand-text" title={view.currentView}>{view.currentView}</span>
            <button className="wv-stand-icon" title="Edit" onClick={() => { setEditText(view.currentView ?? ''); setEditingView(true) }}>✎</button>
            <button className="wv-stand-icon" title="History" onClick={() => setHistoryOpen(true)}>🕑</button>
          </div>
        )}
        <div className="wv-header-right">
          <div className="wv-cost-meter">
            <span className={`wv-cost-dot ${costClass}`} title={`Session cost $${cost.toFixed(2)}`} />
            <span className="wv-cost-label">${cost.toFixed(2)}</span>
          </div>
          <button className="wv-toggle" onClick={() => setCondCollapsed((c) => !c)}>Conductor {condCollapsed ? '↑' : '↓'}</button>
        </div>
      </div>

      <div className="wv-body">
        <div className="wv-chat-pane">
          <div className="wv-messages" ref={messagesRef}>
            {feed.map((it) => {
              if (it.kind === 'user') return <div key={it.id} className="wv-msg-user">{it.text}</div>
              if (it.kind === 'guide')
                return (
                  <div key={it.id} className="wv-msg-guide">
                    <span className="wv-msg-label">Guide · Turn {it.turn}</span>
                    <div className="wv-msg-body">{it.text}{it.streaming && <span style={{ opacity: 0.5 }}>▍</span>}</div>
                  </div>
                )
              if (it.kind === 'artifact') return <ArtifactCard key={it.id} templateId={it.templateId} props={it.props} />
              return <div key={it.id} className="wv-safety-note">{it.text}</div>
            })}
          </div>
          <div className="wv-input-area">
            {costLocked ? (
              <button className="wv-cost-lock" onClick={startFresh}>Start a fresh session</button>
            ) : (
              <div className="wv-input-row">
                <input
                  className="wv-input"
                  placeholder="Pull the thread…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && input.trim()) {
                      send(input)
                      setInput('')
                    }
                  }}
                />
                <button className="wv-send" aria-label="Send" disabled={!input.trim()} onClick={() => { send(input); setInput('') }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M8 3l3.5 3.5L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            )}
          </div>
        </div>

        <MapPane nodes={nodes} onPull={onPull} onSoftClose={onSoftClose} />
      </div>

      <ConductorPane
        rows={rows}
        stats={{ open, closed, dangling: open, cost }}
        onDispute={onDispute}
        collapsed={condCollapsed}
        onToggleCollapse={() => setCondCollapsed((c) => !c)}
      />

      {editingView && (
        <div className="wv-sheet-backdrop" onClick={() => setEditingView(false)}>
          <div className="wv-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Where you stand</h3>
            <textarea className="wv-textarea" value={editText} onChange={(e) => setEditText(e.target.value)} />
            <div className="wv-row" style={{ marginTop: 12 }}>
              <button className="wv-btn-primary" onClick={saveView}>Save</button>
              <button className="wv-btn-ghost" onClick={() => setEditingView(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="wv-sheet-backdrop" onClick={() => setHistoryOpen(false)}>
          <div className="wv-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>How your view got here</h3>
            {view.snapshots.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No snapshots yet.</p>}
            {view.snapshots.map((s) => (
              <div key={s.id} className="wv-snap">
                <div className="wv-snap-date">{new Date(s.createdAt).toLocaleString()}</div>
                <div className="wv-snap-text">{s.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

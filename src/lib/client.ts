'use client'
// Client-side helpers: anonymous local identity, the SSE turn consumer, and the
// small fetch wrappers the UI uses. Identity is a localStorage userId (no accounts).

export const USER_KEY = 'worldview_user_id'

export function getUserId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(USER_KEY)
  if (!id) {
    id = `u_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    localStorage.setItem(USER_KEY, id)
  }
  return id
}

export function setUserId(id: string) {
  localStorage.setItem(USER_KEY, id)
}

export interface OnboardResult {
  mapId: string
  sessionId: string
  sharpenedQuestion: string
}

export async function onboard(body: {
  userId: string
  posture: string
  rawQuestion?: string
  startingPosition?: string
}): Promise<OnboardResult> {
  const res = await fetch('/api/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`onboard ${res.status}`)
  return res.json()
}

export type SseEvent = { type: string; data: unknown }
export type TurnHandlers = {
  onEvent: (ev: SseEvent) => void
  signal?: AbortSignal
}

/** POST /api/turn and dispatch each SSE event to onEvent until `done`. */
export async function streamTurn(
  body: { sessionId: string; message: string; viaShelf?: boolean; viaNodeClick?: boolean },
  handlers: TurnHandlers
): Promise<void> {
  const res = await fetch('/api/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: handlers.signal,
  })
  if (!res.ok || !res.body) {
    handlers.onEvent({ type: 'error', data: { status: res.status } })
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventType: string | undefined
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('event:')) eventType = line.slice(6).trim()
      else if (line.startsWith('data:')) {
        const raw = line.slice(5).trim()
        let data: unknown
        try {
          data = JSON.parse(raw)
        } catch {
          data = raw
        }
        const type = eventType ?? 'message'
        handlers.onEvent({ type, data })
        eventType = undefined
        if (type === 'done') return
      } else if (line === '') eventType = undefined
    }
  }
}

export async function endSession(sessionId: string): Promise<void> {
  await fetch('/api/session/end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  }).catch(() => {})
}

export function endSessionBeacon(sessionId: string) {
  try {
    navigator.sendBeacon('/api/session/end', new Blob([JSON.stringify({ sessionId })], { type: 'application/json' }))
  } catch {
    /* best effort */
  }
}

export async function fetchMap(mapId: string) {
  const res = await fetch(`/api/map/${mapId}`)
  if (!res.ok) throw new Error(`map ${res.status}`)
  return res.json()
}

export async function fetchMaps(userId: string) {
  const res = await fetch(`/api/maps?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) throw new Error(`maps ${res.status}`)
  return res.json()
}

export async function softCloseLoop(loopId: string, sessionId: string) {
  await fetch(`/api/loop/${loopId}/soft-close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
}

export async function disputeReader(sessionId: string, decisionId: string, vote: 'up' | 'down') {
  await fetch('/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, type: 'reader_disputed', payload: { decisionId, vote } }),
  }).catch(() => {})
}

export function isPhoneViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 760
}

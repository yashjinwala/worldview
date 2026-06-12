// In-memory per-session state for the single Node process (TDD §5):
//  - a per-session lock guaranteeing one pipeline in flight at a time
//  - the in-memory loopsClosedThisSession counter
//  - the pendingSeedJobs registry written by /api/onboard, awaited from turn 2
//  - the surprise-me round-robin cursor

interface WvState {
  locks: Map<string, Promise<void>>
  seedJobs: Map<string, Promise<void>>
  loopsClosed: Map<string, number>
  synthesisFiredMem: Map<string, boolean>
  surpriseIdx: number
}

const g = globalThis as unknown as { __wvState?: WvState }

function state(): WvState {
  if (!g.__wvState) {
    g.__wvState = {
      locks: new Map(),
      seedJobs: new Map(),
      loopsClosed: new Map(),
      synthesisFiredMem: new Map(),
      surpriseIdx: 0,
    }
  }
  return g.__wvState
}

// ── per-session turn lock ────────────────────────────────────────────────────
export async function acquireSessionLock(sessionId: string): Promise<() => void> {
  const st = state()
  const tail = st.locks.get(sessionId) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((r) => {
    release = r
  })
  st.locks.set(sessionId, tail.then(() => gate))
  await tail
  return release
}

// ── pending seed jobs ────────────────────────────────────────────────────────
export function setPendingSeed(mapId: string, p: Promise<void>): void {
  state().seedJobs.set(mapId, p)
}
export function getPendingSeed(mapId: string): Promise<void> | undefined {
  return state().seedJobs.get(mapId)
}

// ── loopsClosedThisSession ───────────────────────────────────────────────────
export function getLoopsClosed(sessionId: string): number {
  return state().loopsClosed.get(sessionId) ?? 0
}
export function incrLoopsClosed(sessionId: string): number {
  const next = getLoopsClosed(sessionId) + 1
  state().loopsClosed.set(sessionId, next)
  return next
}

// ── surprise-me round-robin ──────────────────────────────────────────────────
export function nextSurpriseIndex(total: number): number {
  const st = state()
  const idx = st.surpriseIdx % total
  st.surpriseIdx = (st.surpriseIdx + 1) % total
  return idx
}

// ── reset (between tests) ────────────────────────────────────────────────────
export function resetSessionState(): void {
  const st = state()
  st.locks.clear()
  st.seedJobs.clear()
  st.loopsClosed.clear()
  st.synthesisFiredMem.clear()
  st.surpriseIdx = 0
}

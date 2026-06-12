# Build notes

Decisions made where the spec (TDD §17 → TDD body → PRD) was genuinely silent, or where
an implementation detail needed pinning. Resolution order followed the build brief; the
docs were **not** edited. The frozen test suite in `tests/` is unmodified (additions only).

## Routing / infra

- **`/api/_test/*` route folder.** Next.js App Router treats a leading-underscore folder
  (`_test`) as a *private folder* excluded from routing, so `/api/_test/*` 404s. The
  canonical escape is the URL-encoded underscore: the folder on disk is `src/app/api/%5Ftest/`,
  which serves the literal path `/api/_test/...` the harness expects.
- **`.env` committed.** Holds only the non-secret `DATABASE_URL="file:./dev.db"` so
  `npm install && npx prisma db push && npm run dev` works with **only** `ANTHROPIC_API_KEY`
  set (it lives in the gitignored `.env.local`). `.gitignore` ignores `.env.local`/`.env*.local`
  but not `.env`.
- **Per-session lock.** Held across the critical section (pipeline steps 1–6: ingest →
  Reader → apply → Director → dispatch → Tutor stream + state writes). Released before
  step 7; Generator jobs + the safety check run detached but are awaited *within the open
  SSE stream* (25 s cap) so a fast next message never blocks on generation (§5).
- **SSE 404-vs-500 on empty critical queue.** A `reader`/`director`/`tutor` mock-queue-empty
  is a test bug (tests always enqueue what they consume). It logs a `mock_queue_empty` Event
  and emits `done` so the client never hangs (rather than a hard 500 mid-stream, which an
  already-open SSE response can't set). No passing test exercises this path.

## Data model (additive fields, vs. the §8 sketch)

All additive, so the frozen schema-shaped assertions still hold:

- `Loop.openedInSessionId / openedAtTurn / closedInSessionId / closedAtTurn` — power the
  G-01 chain window (`turnOpened − turnOfClose ≤ 2`, same session), the G-02 dangling count
  (`openedInSessionId == S AND closedAt IS NULL`), and the G-14 session-scoped `loopsChained`
  rollup (distinct chained-from sources whose chainer opened in this session).
- `Session.synthesisCaptured` — set true when a synthesis answer is written; drives the G-07
  inheritance (`new.synthesisFired = old.synthesisFired && !old.synthesisCaptured`).
- `Session.isReturn / viaShelf` — bookkeeping for the return/idle flows (G-17).
- `ViewSnapshot.sessionId` — which session captured a snapshot.

## Pipeline behaviors the spec under-specifies

- **Cost-ceiling wrap-up is a hardcoded streamed string, not a Tutor call.** The cost test
  enqueues *no* Tutor mock on the ceiling turn, so the branch must make zero model calls.
  The spec's "send the Tutor one hardcoded directive" is realized by streaming the hardcoded
  message (`COST_LOCK_WRAP_UP`) directly as three `tutor_delta` chunks.
- **Turn numbering excludes `<resume>` blocks.** A return session's first message is a
  `user`-role `<resume>…</resume>` context block; it is not counted as a user turn, so the
  first *real* message is turn 1 (Reader skipped), matching "Turn 1 (return session): no Reader."
- **Settled-node re-entry is a no-op.** If the Reader reports `conversationNodeId` pointing
  at an already-settled node, no loop is reopened and status stays `settled`. Required by the
  "loop opened more than 2 turns after close" lifecycle test, where the conversation lingers
  on a just-closed node across turns before drifting elsewhere.
- **justClosed is applied before the node transition** within step 3, so chain detection sees
  the close when the same turn both closes a loop and moves to a new node.
- **Return vs. idle.** Posting `/api/turn` to a session whose `endedAt` is set = a return
  (shelf by default, `viaShelf` defaults true). An idle-close mid-active-session (>30 min
  since the last user message) runs step 8 on the old session then opens a return session with
  `viaShelf:false` (G-17). Under mock the Director is scripted, so the default directive choice
  is moot for the contract tests.

## UI choices

- **Kickoff message.** Onboarding sends the (possibly edited) sharpened question as turn-1's
  user message; an edited sharpen-confirm retitles via `POST /api/map/[mapId]` so "the user's
  final text is what's stored" (§4). Shelf return sends a short "I'm back…" kickoff with
  `viaShelf:true`.
- **Chat history is not reloaded on resume.** The map is the durable surface ("your
  understanding persists as a map"); `/api/map/[mapId]` rehydrates nodes/loops/artifacts/view,
  and the welcome-back beat re-hooks. §4 defines no messages-refetch endpoint, so a mid-session
  reload starts the chat fresh while the map persists. (Server keeps full history regardless.)
- **`mobile_gate` Event** is deferred: the gate UI + continue-anyway is present and the choice
  is stored in `sessionStorage`, but there is no Session row to attach an Event to before
  onboarding. The kill test is desktop-only by protocol regardless (PRD §10).
- **CSS primitive re-assertion.** `design/tokens.css` wires its primitives into Tailwind v4
  via `@theme inline { --x: var(--x) }`. On routes that also load React Flow's stylesheet, the
  self-referential declaration can win the cascade and make `var(--color-*)` resolve circular
  (an unstyled white page). The section-A primitives are re-stated at the end of
  `globals.css` (values verbatim from tokens.css) as the last, unlayered `:root` so they always
  resolve. tokens.css remains the single source of truth.

## Real-mode (non-mock) LLM

The hard gate is mock-mode; these only matter for `npm run dev` with a real key (verified
end-to-end during the build — streaming, seeding, prompt-cache, live artifact spawn):

- **Models:** Tutor `claude-sonnet-4-6` (Opus 4.8 behind `TUTOR_MODEL`); aux roles
  `claude-haiku-4-5-20251001` (`HAIKU_MODEL`). Pricing constants per §13.
- **Structured outputs.** The pinned `@anthropic-ai/sdk@0.39` does not ship
  `@anthropic-ai/sdk/helpers/zod` (`zodOutputFormat`), so the Haiku structured roles use a
  strict-JSON instruction + parse + one retry (G-16) rather than `output_config.format`. Each
  generator-artifact call is handed an explicit per-template prop spec (`src/templates/promptSpecs.ts`)
  so it fills schema-valid props on the first attempt; props are still Zod-validated server-
  side and re-validated on the client at `artifact_ready` (§10).
- **Tutor caching.** The anchor (`TUTOR_ANCHOR`, padded past 2,048 tokens with mode exemplars)
  carries `cache_control` on its single system block; a `tutor_usage` Event logs
  `cache_read_input_tokens` per turn. Measured live: turn-2 `cache_read_input_tokens = 2408`.
- **`FORCE_ARTIFACT`** (§16 item 3) accepts a template id or `true` (→ `slider-sim`); it forces
  a `spawnArtifact` on the next eligible (non-turn-1, on-map) turn.

## Deferred (consistent with v1 scope, noted for honesty)

- Surprise-me uses **round-robin only**; the session-3+ interest-matching pick (G-08) falls back
  to round-robin, which keeps surprise-me from ever invoking the `sharpen` role.
- The disconnect/reconnect message-refetch (§4) is partial (map re-fetched, chat not).
- `v1.5` grounding (orchestrated web search) and the 14 phase-2 templates are out of v1 scope.

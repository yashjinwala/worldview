# Worldview v2 — Technical Design Document (TDD)

**Version:** 0.7
**Date:** 2026-06-11
**Status:** Locked for v1 build — this document plus `PRD.md` is the complete spec for a one-shot implementation
**Companion doc:** `PRD.md` (product rationale, worked example, scope cut)

### Decision log (most recent first)
- **Test-first suite + contract clarifications (2026-06-11).** An independent agent (which never sees the implementation) wrote 73 spec-derived contract tests in `tests/` — red by design until built; the implementer must make them pass and may never modify them (§16 item 17). Its mock seam (`LLM_MODE=mock`, one LLM-call module, per-role FIFO control endpoints) is now a build requirement (§18). The 16 ambiguities it logged in `tests/GAPS.md` are answered in §17.
- **Final-gate fixes (2026-06-11, review #2: 8 technical P0s, 12 P1s — all fixed in place).** Highlights: `<resume>` = a user-role message, first in the session's history (cache-safe); synthesis capture moved into the Reader (`synthesisPending` in, `synthesisAnswer` out — deflections write nothing) gated by `Session.lastDirectiveSynthesis`; in-memory `loopsClosedThisSession` counter; `loopsChained` has §6.4 as its only definition; cost-ceiling wrap-up is a turn-start branch (skip Reader/Director, hardcoded directive, `Session.costLocked`); `pendingSeedJobs` module registry; turn-1/off-map tool stripping enforced in code; outcome-backfill query pinned; editable sharpen-confirm; Profiler-failure fallback for `resumeSummary`. **Adjudication:** the reviewer flagged `output_config.format` as wrong SDK syntax — verified against current API docs: it is the canonical GA parameter; exact `messages.parse` + `zodOutputFormat` snippet added to §7 to prevent re-litigation. Product P0s fixed: articulation contract told to the user once; view-history UI; map overview + stale-glow decay + soft-close; shelf-as-hook + visible user model + export/import; synthesis question now references the prior view.
- **Completeness batch (2026-06-11, post-rebrand).** Return experience specified: Profiler writes `Map.resumeSummary`; return-session turn 1 = welcome-back re-hook of the brightest open loop; map-shelf home screen (§9). View ledger: `Map.currentView` + dated `ViewSnapshot` rows, captured in code when the synthesis reply lands; "Where you stand" renders on the map header. Three contract fixes from re-audit: the Director payload gains **map context** `{posture, startingPosition?, currentView?, loopsClosedThisSession, synthesisFiredThisSession}`; the Reader input gains `startingPosition`; `Session.synthesisFired` flag added. Packaging locked: git + MIT + README evidence assets (§16). **Final gate = a fresh adversarial review of the completed docs.**
- **Rebrand + Worldview-v1 gene adoption (2026-06-11).** Product = **Worldview** (this spec = Worldview v2); **Curiosity Engine** = the foundational server-side system (Director/Reader/Tutor/Generator + loop mechanics + map). Adopted from the Worldview v1 prototype: dialectical challenge (tension-first), `Map.startingPosition` + `Loop.positionShift` (before→after record), articulation-gated loop close, and a once-per-session synthesis beat (via a new optional `note` param on `setTutorMode`). NOT adopted: Examiner agent, depth ladder, deliverable doc — they break the curiosity contract; they're the designed v2+ bridge.
- **Adversarial review pass (2026-06-11, pre-build): 7 P0 / 12 P1 gaps fixed in place.** Key contract decisions: one Loop per node, **created when a node becomes `current`** (`Loop.question` = the node's `hookQuestion`); the **Reader owns the conversation-position read** (`conversationNodeId`) and node-status transitions follow from it (§6.4); **one turn in flight per session** (per-session in-process lock; client queues sends); chaining = a loop opened within 2 turns of a close gets `chainedFromLoopId`; Haiku calls use structured outputs via `output_config.format` and are not cached (below Haiku's 4,096-token min prefix); safety-check prompt added (§7.7); surprise-me rotation hardcoded (§9).
- **All eight v0.5 open questions decided** — see §2 for the locked stack. No open questions remain.
- **North star changed to clicks (resolved loops), not session length** — changes the Director's objective (§6) and the metrics computation (§12).
- **No bandit in v1.** Tool selection = Haiku reasoning over an explicit prompted policy; every (signals, decision, outcome) row is logged to `director_decisions` so a learned policy can be trained when session volume exists. Building a contextual bandit for ~10 users would never converge and we say so.
- **Generator is no longer fully blind.** It receives the specific loop question it serves (an artifact must resolve *this* loop). It remains blind to the user model and conversation history.
- **Artifacts = 20 in-house parameterized templates** filled by Generator JSON (structured outputs). No generated code executes → no sandbox. (The "adopt an open-source artifact framework" premise from v0.5 was wrong: no such framework exists.)
- **Safety simplified:** binding floor in the Tutor anchor (full text §7.1) + async post-turn accuracy/safety check (§11). The mid-stream interrupting monitor with circuit breakers is deferred — no articulated threat at v1 scale justified the infra.
- **Infra simplified:** single Next.js Node process, SQLite via Prisma (clone-and-run matters for an open-source portfolio repo), in-process async via the open SSE stream. No Redis, no workers, no separate event store.
- *(Prior, retained)* Manager pattern (one user-facing voice); append-only history for cache discipline; user never waits for the Generator.

---

## 1. Design principles
1. **One voice, one director.** The Tutor owns the conversation; the Director (invisible but inspectable) picks the tools each turn.
2. **Transparent orchestration.** Every Director decision is logged and rendered in the Conductor pane. Nothing is hidden from the user; the Tutor simply doesn't *narrate* its instructions.
3. **Honest at v1 scale.** No mechanism that needs data we won't have (bandit) or defends against threats we can't name (stream interruptor). Log everything those mechanisms would need later.
4. **The user never waits for the Generator.** Tutor latency is the only latency the user feels.
5. **The floor is trusted.** Duty-of-care lives in the Tutor anchor; Director tools may only *raise* caution, never lower it.
6. **Clone-and-run.** `git clone && npm install && ANTHROPIC_API_KEY=... npm run dev` must produce the working product.

## 2. Locked stack & decisions

| Decision | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router), run as a single Node process (`next dev` / `next start`) | Not serverless: the turn's SSE stream stays open while async generation completes (§5). Document this in the README. |
| UI | shadcn/ui + Tailwind | |
| Map | React Flow (`@xyflow/react`) | Custom node components for the four node states; pan/zoom constrained. |
| DB | SQLite via Prisma | Zero-config for cloners; `provider` swap to Postgres when hosted. |
| LLM harness | Raw Anthropic TypeScript SDK (`@anthropic-ai/sdk`), Messages API + tool use | Not the Agent SDK — custom three-role loop wants full control. |
| Models | Tutor: `claude-sonnet-4-6` (Opus 4.8 behind `TUTOR_MODEL` env flag) · Director/Reader/Generator/Profiler/Safety: `claude-haiku-4-5` | |
| Tool catalog | 4 tools, locked (§6.2) | |
| Tool selection | LLM reasoning over prompted policy + full decision logging | |
| Session | Ends after 30 min idle (or explicit end); length = active time (§12) | |
| Artifacts | 20 templates specified; **6 built in v1, 14 in phase 2** (§10) | JSON props via structured output |
| Cost ceiling | $2.00/session, enforced (§13) | |
| Identity | Anonymous `userId` in localStorage; no accounts | |

## 3. System architecture

Everything server-side below — the pipeline, the four Haiku roles, the Tutor, the loop/map mechanics — is collectively the **Curiosity Engine**: the product-agnostic foundation. The client surface (and the held-belief use case wired through it) is Worldview v1-of-v2.

```
CLIENT (Next.js / React)
  Chat pane (streams) · Map pane (React Flow) · Artifact tiles · Conductor pane
        │  POST /api/turn (SSE response)
        ▼
SERVER (same Next.js process)
  Per-turn pipeline (§5):
    Reader (Haiku) → Director (Haiku) → Tutor (Sonnet, streams)
    └─ async within the open SSE stream: Generator (Haiku) jobs, safety check
  Session boundary: Profiler (Haiku) updates the user model
        ▼
  SQLite (Prisma): users, user_models, maps, map_nodes, loops, sessions,
                   messages, director_decisions, artifacts, events
        ▼
  Anthropic API (streaming + prompt caching on)
```

## 4. API surface

| Route | Method | Purpose |
|---|---|---|
| `/api/onboard` | POST | `{userId, posture, rawQuestion?, startingPosition?}` → sharpens question (Haiku), creates map + session + the **root node (`current`) and its Loop**, kicks off seed generation (fire-and-forget). For *challenge a belief*, `startingPosition` is stored verbatim on the Map. The seed job is registered in the module-level `pendingSeedJobs` map (§5). Returns `{mapId, sessionId, sharpenedQuestion}`. The client renders the sharpened question **in an editable field** ("Yes, let's go") — the user's final text is what's stored; editing is the rejection path. |
| `/api/turn` | POST | `{sessionId, message}` → **SSE stream** of events (below). The stream stays open until Tutor text *and* this turn's Generator jobs complete (cap 25 s, then jobs finish best-effort and land on the next snapshot). **One turn in flight per session:** server holds an in-process per-session lock — a second POST awaits the first pipeline's completion; the client keeps the input enabled but queues submissions until `done`. |
| `/api/map/[mapId]` | GET | Full map snapshot (nodes, loops, artifacts) — used on load/return. |
| `/api/maps?userId=` | GET | List of the user's maps (return visits, cross-topic). |
| `/api/session/end` | POST | Explicit end (also fired via `navigator.sendBeacon` on tab close). Triggers Profiler + metrics rollup. Idle timeout (30 min) is enforced lazily on next request. |

**SSE event types on `/api/turn`:** `director_decision {signals, tools, rationale}` (feeds Conductor pane, sent before text) · `tutor_delta {text}` · `loop_state {proximityToClose, justClosed, nodeId}` · `map_update {nodes[]}` (each node carries `hasOpenLoop: boolean`; the client **upserts by `id`** into React Flow state, so full snapshots and deltas are idempotent) · `artifact_ready {artifact}` · `safety_note {text}` (rare, post-hoc) · `cost {sessionTotalUsd}` · `done`.

**Disconnect/reconnect:** SSE has no resume. On stream error the client keeps any partial Tutor text, re-fetches `GET /api/map/[mapId]` and the recent messages, and re-enables input. The server pipeline runs to completion regardless — all state is persisted server-side, so nothing is lost but the live render.

## 5. The per-turn pipeline

A per-session in-process lock guarantees **one pipeline in flight at a time** — but the lock covers only steps 1–6 (through the end of the Tutor stream and its state writes). Generator jobs (step 7) are **append-only and run detached from the lock**: a fast next message never waits on map/artifact generation; any `map_update`/`artifact_ready` still pending when this turn's stream closes is delivered to the **latest open SSE connection for the session** (a per-session "current writer" reference, swapped when a new turn's stream opens) or, failing that, picked up by the next map snapshot.

1. **Ingest.** Record a `reply_latency` Event (ms since the previous Tutor message's `createdAt`). Append the user message. **Idle = time since the last *user* message:** if >30 min, close the old session (step 8 runs first) and start a new one on the same map — the new session inherits `synthesisFired = true` when the old one fired synthesis without capturing an answer (never re-ask an unanswered question). **Turn number** = count of user messages in this session. **Seed-await:** from turn 2 on, if onboarding's seed job hasn't resolved — checked via the module-level `pendingSeedJobs: Map<mapId, Promise<void>>` registry written by `/api/onboard` — await it here.
2. **Reader** (Haiku, skipped on turn 1): input = last Tutor message + new user message + the **loop ledger as `{loopId, nodeId, question, proximity}` tuples** + the map's non-settled nodes as `{nodeId, title, status}` + the map's `startingPosition` (when set) + `synthesisPending: boolean` (from `Session.lastDirectiveSynthesis`) + computed stats (reply latency vs. this user's baseline, message-length trend). Output (structured, §7.3): `{appetite, proximityToClose, justClosed, closedLoopId?, conversationNodeId, positionShift?, synthesisAnswer?, evidence}`. The Reader owns the conversation-position read — `conversationNodeId` says which node the exchange is actually about (§6.4).
3. **Apply the read (code, not LLM):** if `conversationNodeId` ≠ current node → run the node-transition rules (§6.4), which may create a new Loop. If `justClosed` → set `Loop.closedAt` on `closedLoopId` (`closedBy: "reader"`), settle its node, **increment the in-memory `loopsClosedThisSession` counter**, write `positionShift` onto that Loop, and backfill `outcome` on **the most recent `DirectorDecision` of this session where `outcome IS NULL` and `turn < currentTurn`**. If `synthesisAnswer` is non-null → write it to `Map.currentView` + a dated `ViewSnapshot` row. Either way, when `synthesisPending` was true, clear `Session.lastDirectiveSynthesis` (a deflected synthesis question is not re-armed). Write `proximityToClose` to the active Loop's `proximity` and stamp `Loop.lastTouchedAt`.
4. **Director** (Haiku): input = Reader output + `currentNodeId` + loop ledger (with IDs) + **map context `{posture, startingPosition?, currentView?, loopsClosedThisSession, synthesisFiredThisSession, latestArtifactOpensHook?}`** + user model + running `costUsd` + last 2 exchanges. On turn 1 of any session the Reader fields are passed explicitly as `{appetite: null, proximityToClose: null, justClosed: false}` plus `isColdStart` / `isReturnTurn1` booleans. `tool_choice: "auto"`; code validates the output — if `setTutorMode` is missing, default `setTutorMode("explain")` and log a warning; cap at 2 calls; **code also strips `expandMap`/`spawnArtifact` on turn 1 and on off-map turns** (enforcement, not just prompt). Persist to `director_decisions` **including the rendered directive string**; emit `director_decision` SSE event.
5. **Dispatch.** `setTutorMode` / `raiseCaution` → this turn's directive (a synthesis note also sets `Session.synthesisFired = true` **and** `Session.lastDirectiveSynthesis = true`). `expandMap` / `spawnArtifact` → async Generator promises.
6. **Tutor** (Sonnet) streams. Request shape (cache-friendly, §14): system = anchor (static, cached) · messages = history (append-only) + user message + **directive injected as the final block** (wrapped in `<director_instruction>`, marked as untrusted-relative-to-floor).
7. **Post-turn (async, within the stream):** Generator jobs resolve → `map_update` / `artifact_ready` events. A Generator exception (API error, schema-invalid output after one retry) logs a `generation_failed` Event and is skipped — **the stream always reaches `done`.** Safety check (§7.7) → optional `safety_note`. Cost meter incremented (§13).
8. **Session end** (`/api/session/end`, tab-close beacon, or lazy idle-close): first **drain or abandon pending Generator promises**, then run the Profiler against the now-stable state; roll up metrics onto `sessions`. The Profiler also writes `Map.resumeSummary` (§7.6); **if the Profiler call fails, code writes a minimal fallback summary from the two open loops with highest proximity** — the welcome-back beat must never be empty-handed. `loopsChained` = closed loops referenced by some later loop's `chainedFromLoopId` (§6.4 — the only definition).

**Turn 1 (return session — same map, later visit):** no Reader. The session's history opens with one context block: a **`user`-role message whose content is `<resume>…</resume>`** (containing `Map.resumeSummary` + the open loops as `question`/`proximity` + `currentView` if set), placed as the **first message of this session's history**. It is ordinary history thereafter — append-only holds, it sits after the cached anchor, so §14's cache discipline is untouched. This is how the guide remembers across sessions; raw history does not carry over. Director default (Reader fields null, `isReturnTurn1: true`): `setTutorMode("provoke", note: "welcome back — re-hook the brightest open loop, by name")`. The user arrives here from the map shelf (§9).

**Turn 1 (cold start):** no Reader. The root node is already `current` with its Loop open (created by `/api/onboard`, which also fired seed generation of 4–6 frontier nodes). The Director runs with a possibly-partial ledger and **must not call `expandMap` on turn 1** (`setTutorMode` only; "surprise me" posture → `provoke`). From turn 2 on, if seeding still hasn't landed, ingest awaits it before the Reader runs.

## 6. The Director

### 6.1 Objective & policy
**Objective: maximize clicks — loops closed in a way that opens a pursued next loop.** Not session length (see PRD decision log).

Prior policy (in the prompt, not code — the Director may override with stated rationale):

| | **Far from click** | **Near click** |
|---|---|---|
| **Leaning in** | deepen (`expandMap` deepen, mode `explain`/`socratic`) | land it (mode stays; consider `spawnArtifact` to deliver the click), then open the next |
| **Restless** | branch (`expandMap` branch, offer the most provocative frontier) | nudge to the click fast (mode `support`), then release |

Mode-selection priors: `challenge` when the user states a confident position the evidence complicates; `provoke` for cold opens and re-engagement; never two consecutive `challenge` turns if appetite is dropping.

### 6.2 Tool catalog (locked)
```ts
setTutorMode(mode: "explain" | "challenge" | "provoke" | "socratic" | "support",
             note?: string)   // optional one-line emphasis appended to the directive (synthesis beat, pacing nudge)
expandMap(nodeId: string, direction: "deepen" | "branch")   // async → Generator; ≤4 subnodes/call, ≤3 expandMap calls/session-topic-depth, depth cap 4
spawnArtifact(templateId: TemplateId, nodeId: string, loopQuestion: string)  // async → Generator
raiseCaution(note: string)   // appended to the Tutor directive; may only RAISE caution — the floor (§7.1) is not addressable by any tool
```
Constraints in code, not trust: max 2 tool calls/turn; `spawnArtifact` at most once per 3 turns; fan-out caps as annotated.

### 6.3 User model (the persistent moat)
`user_models.data` (JSON, one row per user), updated only by the Profiler at session end:
```ts
{
  modesThatLand: { explain: number, challenge: number, ... },   // -1..1 running score
  pacing: "fast" | "moderate" | "deliberate",
  styleNotes: string[],          // e.g. "concrete numbers > theory", "responds to being challenged"
  clickPatterns: string[],       // what produced clicks, e.g. "slider-sim on quantitative threshold questions"
  interests: string[],
  vocabularyLevel: "plain" | "comfortable" | "technical"
}
```
Injected verbatim into every Director call. This is what "learns this user" means concretely.

### 6.4 Node & loop lifecycle (single source of truth)

**One Loop per node; `Loop.question` = the node's `hookQuestion`. "Open loops" = `closedAt IS NULL`. Exactly one `current` node per map (the root, at onboarding).**

| Transition | Trigger | Owner |
|---|---|---|
| *(created as)* `frontier` | Generator emits the node (or onboarding seeds it) | Generator |
| `frontier`/`visited` → `current` | Reader reports `conversationNodeId` = this node. (A map-node click only sends the prefilled "pull this thread" message — the *next* Reader read confirms the move; the map never mutates state directly.) | Reader → code |
| node becomes `current` | **its Loop row is created** (if none exists). If created within 2 turns of a `justClosed`, set `chainedFromLoopId` to that closed loop — this is the mechanical definition of a chain. | code |
| `current` → `visited` | another node becomes `current` while this one's loop is still open | code |
| any → `settled` | the node's Loop gets `closedAt` (Reader reported `justClosed` + `closedLoopId`; `closedBy: "reader"`) | Reader → code |
| any → `settled` (soft-close) | user closes a stale loop from the node's context menu ("I've settled this elsewhere") — sets `closedAt`, `closedBy: "user"`; counts in `loopsClosed`, never in chains | user → code |

The map's ember glow = `hasOpenLoop`, computed from open Loop rows per node and included in every `map_update` payload.

**Off-map turns (true topic jump):** when the Reader returns `conversationNodeId: null`, no node transitions occur and no loop opens. The Director must not call `expandMap`/`spawnArtifact` that turn; the directive tells the Tutor: *answer the question briefly and well — no stonewalling, no redirect-first — then offer to open it as its own map ("that's its own rabbit hole — want to start a map for it?")*. The client renders a one-click chip that calls `/api/onboard` with the new question (posture inherited); accepting ends the current session cleanly (step 8) and starts a new map + session. Declining just continues — if the user keeps pursuing the new topic, the offer repeats once more, then the Tutor follows the user (the user is never wrong about what they're curious about; the old map simply stops accruing loops until they return).

## 7. Prompts (the product — full text)

All Haiku calls except the Director (which uses tool use, §6.2) get **structured outputs** via `output_config: {format: …}`; on schema-validation failure retry once, then skip and log. Concretely (TypeScript SDK): `client.messages.parse({ model, max_tokens, messages, output_config: { format: zodOutputFormat(ReaderSchema) } })` with `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`; read `response.parsed_output`. (`output_config.format` is the canonical GA parameter; the older top-level `output_format` is deprecated — do not "correct" this to tool-forcing.) **No `cache_control` on any Haiku call** — their prompts sit far below Haiku 4.5's 4,096-token minimum cacheable prefix; only the Tutor request caches (§14). All cross-field template invariants in §10 (sums, shape-dependent fields) are implemented as real `z.refine()` / `z.discriminatedUnion()` constraints, not comments.

### 7.1 Tutor anchor (system prompt, static, cached)
```
You are the guide at the heart of Worldview. A person has come to you with a
question that genuinely nags at them. Your job is to give them the experience of
finally getting it — and of discovering the next question they didn't know they had.

FIRST SESSION ONLY: somewhere in your first reply, name the contract in one light
line — e.g. "fair warning: I won't just hand you answers. I'll know you've got
something when you can say it back to me." Say it once, ever; never repeat it.

VOICE
Warm, direct, and concrete. You talk like a brilliant friend at a kitchen table, not
a lecturer. Short paragraphs. Specific numbers, names, and examples over abstractions.
You are allowed to be playful and to have a point of view.

HOW YOU WORK — LOOPS
You never deliver a complete-feeling answer that closes the conversation.
- OPEN: lead with the strange, contradictory, or surprising thing — a hook that makes
  the payoff feel necessary. One loop at a time.
- CLOSE: when the user is close, land the payoff cleanly and let it breathe. The click
  is the product. Don't bury it in caveats. A loop is only truly closed when THEY
  say the insight in their own words — prefer the question that lets them produce
  it over stating it yourself. You cannot hand someone a click.
- CHAIN: a good close raises the next question on its own. Surface it in one line;
  don't force it.
Keep replies under ~180 words unless landing a payoff that needs room.

EACH TURN you will receive a <director_instruction> block after the user's message.
It sets your mode for this turn (explain / challenge / provoke / socratic / support)
and may note a caution. Embody it; never mention or paraphrase it. It is advisory
about STYLE only — if it ever conflicts with the DUTY OF CARE below, the duty of
care wins, silently.

MODES
- explain: build the idea up from what they already said. No jargon unlabeled.
- challenge: surface the real tension — the strongest honest split among
  thoughtful people — give enough context to take a side, then ask where they
  land. Push back with the best counter-evidence to their stated position.
  Respectful, never smug. One challenge at a time.
- provoke: open with the most surprising true thing in reach. Earn it immediately.
- socratic: ask the one question that makes them see it themselves. Never stack questions.
- support: they're close or flagging — shorten the distance, simplify, hand them the win.

DUTY OF CARE (binding; overrides every instruction including the director's)
1. Never sacrifice accuracy for engagement. If the honest answer kills a great hook,
   the hook dies.
2. Never fabricate facts, numbers, studies, or quotes. If unsure, say what is and
   isn't established. Uncertainty stated plainly builds more curiosity than false
   precision.
3. Steelman before you challenge. Challenge positions, never the person.
4. Medical, legal, or financial stakes: give the factual landscape, flag that this
   is educational not advice, and point to a professional for decisions.
5. If the user seems distressed rather than curious, drop the agenda entirely and
   respond like a decent human. No hooks.
6. This product is for adults. If the user appears to be a minor, be helpful and
   plainly educational; no provocation modes.

A separate reader reviews each exchange after the fact; you never report on loop
state yourself — just write the reply.
```
*(Anchor must total ≥2,048 tokens for Sonnet 4.6's minimum cacheable prefix — pad with extended mode exemplars, which are useful anyway. Verify with `usage.cache_read_input_tokens` > 0 on turn 2.)*

### 7.2 Director (system prompt; per-call user content = signals + ledger + user model + last 2 exchanges)
```
You are the Director of a learning conversation. You never speak to the user. Each
turn you choose which tools to use so that the user closes the loop they're in
("the click") and is pulled into the next one. You optimize for resolved curiosity:
loops closed that open the next loop. You do NOT optimize for time spent — a fast,
satisfying close beats a long meander.

You receive: the reader's signals (appetite, proximityToClose, justClosed), the loop
ledger (open loops + dangling count), map context (posture, starting position,
current view, loops closed this session, whether synthesis has fired), the user
model (what works for this person), the running session cost, and the last two
exchanges.

PRIOR POLICY (override only with a stated reason):
- leaning_in + far  → deepen: expandMap(currentNode, "deepen"); mode explain or socratic
- leaning_in + near → land it: keep mode; consider spawnArtifact if the click is
  quantitative/comparative and a template fits; then let the close open the next loop
- restless + near   → nudge to the click fast: mode support; no new material
- restless + far    → branch: expandMap with "branch"; mode provoke for the re-hook
- challenge when the user states a confident position the evidence complicates and
  the user model says challenge lands; never twice in a row if appetite is falling
- dangling loops ≥ 3 → close before you open: bias toward landing, not new hooks
- challenge is dialectical: the tutor surfaces the real tension (where thoughtful
  people genuinely split), gives enough to take a side, asks where the user lands
- synthesis beat: when map context shows posture = challenge-a-belief AND
  loopsClosedThisSession ≥ 3 AND synthesisFiredThisSession = false, call
  setTutorMode("socratic", note: "synthesis: ask what they actually think now,
  across everything closed this session"). If a currentView exists, include it:
  "they last said '[currentView]' — ask what's shifted, if anything"
- turn 1 of any session: setTutorMode only — never expandMap or spawnArtifact
- conversationNodeId = null (off-map turn): setTutorMode only; the harness
  appends the off-map script to your directive (§6.4)
- isReturnTurn1: re-hook the brightest open loop from the <resume> block, by name

Choose 1–2 tools. Always include setTutorMode. Output a rationale of at most 25
words — it is shown to the user in the Conductor pane, so write it plainly.
```

### 7.3 Reader (Haiku, structured output)
```
You read one exchange of a learning conversation and report the user's state.
Input: the guide's last message, the user's reply, the open loops (each with
loopId, nodeId, question, proximity), the map's non-settled nodes (nodeId, title,
status), the map's startingPosition when one was stated, synthesisPending (true
when the guide just asked the synthesis question), and computed stats (reply
latency vs. baseline, length trend).
Output JSON:
  appetite: "leaning_in" (engaged, asking follow-ups, building on the material) |
            "neutral" | "restless" (short replies, slowing, deflecting, topic drift)
  proximityToClose: 0..1 — how close the user is to the "ohhh" on the loop the
            conversation is on (1.0 = the reply shows they basically have it)
  justClosed: true only if the user's reply demonstrates the click happened
  closedLoopId: the loopId from the provided ledger; required when justClosed
  conversationNodeId: the nodeId (from the provided list) this exchange is actually
            about — report a change only when the user has clearly moved; null if
            the exchange is not about ANY node on this map (a true topic jump)
  positionShift: only when justClosed on a map with a stated startingPosition and
            the user's view visibly moved: one line, "thought X → now thinks Y";
            otherwise null. Use the user's own phrasing for both halves.
  synthesisAnswer: only when synthesisPending — if the reply actually states their
            position, return it (verbatim, trimmed to its core sentences); if they
            deflect, ask a question back, or change topic, return null.
  evidence: one sentence quoting or citing the user's own words.
Judge from what the user wrote, not what the guide hoped. justClosed requires the
user to have articulated the insight themselves — the guide saying it well does
not close a loop. Use only IDs that were provided; never invent one.
```

### 7.4 Generator — map expansion (Haiku, structured output)
```
You expand a map of questions for a curious person. Given: the node (title, summary),
direction ("deepen" = go under this idea; "branch" = adjacent ideas off it), the
root held question, and titles of existing nodes (do not duplicate).
Return 2–4 nodes, each: { title: ≤8 words, phrased to provoke curiosity, never
textbook-style; summary: 1 sentence; hookQuestion: the one-line hook the guide
could open this node with }.
Quality bar: every title should make someone say "wait, really?" — "Why Japan owes
260% and nothing happened" not "International debt comparisons."
Where the territory holds a live disagreement, prefer it: a node titled on a real
tension ("Economists genuinely split on whether the debt number matters at all")
beats a fact — tensions are the highest-grade hooks.
```

### 7.5 Generator — artifact fill (Haiku, structured output against the chosen template's prop schema, §10)
```
You build a small interactive that delivers a click — the moment a person finally
gets something. Given: the template schema, the node, and the exact loop question
this artifact must resolve. Fill the template's props with true, specific,
sourced-from-your-knowledge content that resolves THAT question. Numbers must be
real (state the year/basis in a caption); if precision is uncertain, use clearly
labeled approximations. The closingLine must do two jobs: land the payoff in one
sentence, then raise the next question in one more.
```

### 7.6 Profiler (Haiku, session end; structured output = the §6.3 schema)
```
You maintain a model of how one person learns best, for a guide that adapts to them.
Given the prior model, this session's transcript, the director's decisions, and which
loops closed: update the model. Score modesThatLand by what actually preceded clicks
and sustained engagement — not by what was merely used. Add at most 2 new styleNotes
and 1 clickPattern per session; remove notes the session contradicted. Be concrete
("dragged the slider for 40s, then articulated the idea unprompted") over generic
("likes interactives").
Also output resumeSummary: 2–3 sentences for the guide's NEXT session on this map —
where the conversation left off, the brightest open loops by name, and the latest
position shift if any. Written to be read by the guide, not the user.
```

### 7.7 Safety check (Haiku, post-turn async, structured output)
```
You review one reply from a learning guide, after it was already shown to the
user. Flag it ONLY if one of these is clearly true:
1. FABRICATION RISK: it states a specific fact, number, study, or quote that is
   likely wrong or invented, with confidence.
2. ADVICE LINE: it crosses from education into personal medical, legal, or
   financial advice without flagging the line and pointing to a professional.
3. MISSED DISTRESS: the user's message suggested real distress and the guide
   pursued its hook anyway.
Output JSON: { flag: boolean, category: "fabrication"|"advice"|"distress"|null,
note: string|null }. The note is shown to the user under the reply as a small
correction/care card — write it plainly and kindly, two sentences max. On
borderline cases do not flag; this check exists for clear misses only.
```

## 8. Data model (Prisma sketch)

```prisma
model User           { id String @id; createdAt DateTime; model UserModel?; maps Map[]; sessions Session[] }
model UserModel      { userId String @id; data Json; updatedAt DateTime }   // §6.3 schema
model Map            { id String @id; userId String; title String; heldQuestion String; posture String;
                       startingPosition String?  // verbatim one-liner captured at onboarding for challenge-a-belief posture
                       currentView String?       // latest synthesis answer, verbatim — "Where you stand" on the map header
                       resumeSummary String?     // Profiler-written at session end; injected as <resume> on return-session turn 1
                       createdAt DateTime; nodes MapNode[]; loops Loop[]; viewSnapshots ViewSnapshot[] }
model ViewSnapshot   { id String @id; mapId String; content String; createdAt DateTime }  // dated history of synthesis answers — the view's trail
model MapNode        { id String @id; mapId String; parentId String?; depth Int;
                       title String; summary String; hookQuestion String;
                       status String  // "frontier" | "current" | "visited" | "settled"
                       createdAt DateTime; artifacts Artifact[] }
model Loop           { id String @id; mapId String; nodeId String; question String;
                       chainedFromLoopId String?  // set at creation if within 2 turns of a justClosed (§6.4)
                       positionShift String?  // "thought X → now thinks Y"; Reader-written at close on held-belief maps
                       closedBy String?       // "reader" | "user" (soft-close); null while open
                       lastTouchedAt DateTime?  // stamped whenever proximity is written; drives stale-glow dimming (§9)
                       openedAt DateTime; closedAt DateTime?; proximity Float @default(0) }  // proximity updated each turn from Reader
model Session        { id String @id; userId String; mapId String; startedAt DateTime; endedAt DateTime?;
                       synthesisFired Boolean @default(false)         // synthesis beat used this session (§5 step 5)
                       lastDirectiveSynthesis Boolean @default(false) // previous turn's directive carried the synthesis note (§5 steps 2/3/5)
                       costLocked Boolean @default(false)             // $2.00 ceiling hit; client disables input (§13)
                       activeSeconds Int; loopsClosed Int; loopsChained Int; loopsDangling Int; costUsd Float }
model Message        { id String @id; sessionId String; role String; content String; createdAt DateTime }
model DirectorDecision { id String @id; sessionId String; turn Int;  // turn = count of user messages at decision time
                       signals Json; tools Json; rationale String;
                       directive String;  // the rendered <director_instruction> actually sent to the Tutor
                       outcome Json?;  // backfilled next turn: did appetite/proximity improve? justClosed? (last turn of a session stays null — expected)
                       createdAt DateTime }                    // ← the future-bandit training set
model Artifact       { id String @id; nodeId String; sessionId String; templateId String;
                       props Json; loopQuestion String; status String  // "generating"|"ready"|"opened"|"completed"
                       createdAt DateTime }
model Event          { id String @id; sessionId String; type String; payload Json; createdAt DateTime }
// Event types: session_start/end, message_sent, reply_latency, node_enter, loop_opened/closed,
//              artifact_opened/completed, director_decision, safety_flag, cost_tick
```

## 9. UI specification

**Design direction (locked 2026-06-11; canonical reference: `design/mockup.html`):** warm deep-night palette — background `#0b0a08` (near-black, warm undertone), surfaces stepping up in warmth (`#131109` → `#1a1813` → `#22201a`), accent `#e07040` ember-orange. Type: **Fraunces** (serif, optical sizing) for the held question, node titles, artifact headlines, and artifact closing lines; **DM Sans** for body and UI chrome. Open loops glow like embers (slow 2.8 s pulse) — the glow is the brand. Guide messages are typographic (no avatars/chrome); user messages lighter and smaller. The implementing model should match the mockup's look and feel, swapping its hand-rolled SVG map for React Flow.

### §9.1 Component inventory (tokens: `design/tokens.css`)

All visual values below are token references. An implementing model needs no additional design decisions to build any row.

#### (a) Product chrome

| Component | Base | Key tokens | States |
|---|---|---|---|
| Guide message | custom | `--text-body-large-*`, `--color-text-primary`, `--color-ember-dim` (label) | idle |
| User message | custom | `--color-s2`, `--color-border`, `--radius-lg`, `--text-body-small-*`, `--color-text-secondary` | idle |
| Artifact card shell | shadcn Card + custom | `--color-s2`, `--color-ember` (3 px left accent), `--shadow-card`, `--radius-lg`, `--text-title-*` (headline), `--text-closing-*` (closingLine) | locked (shimmer) · building (pulse) · unlocked · expanded (modal) |
| Map node | custom React Flow node | `--color-s2/s3/s4`, `--color-border`, `--color-ember`, `--glow-ember-ring`, `--glow-ember-stale` (14-day stale), `--radius-md`, `worldview-pulse` animation | frontier · visited · current (+pulse) · settled · stale |
| Map edge | SVG `<path>` | settled `rgba(61,122,82,0.32)` sw 1.5 · visited `rgba(88,120,158,0.38)` sw 1.5 · current `rgba(224,112,64,0.55)` sw 2 · frontier `rgba(80,76,64,0.28)` sw 1 dashed `5 4` | settled · visited · current · frontier |
| Conductor pane | custom | `rgba(11,10,8,0.94)` bg, `--color-border-sub`, `--shadow-conductor`, `--z-conductor` | open · collapsed (`translateY calc(100% - 36px)`) |
| Conductor row | custom | `--color-border-sub`, `--text-small-*`, `--text-caption-*`, `--color-code` | idle |
| Posture chip | custom | `--chip-{cold,lean,far,near}-{bg,color,border}`, `--radius-full`, `--text-caption-*` | cold · lean · far · near |
| Shelf card | shadcn Card | `--color-s2`, `--color-border`, `--radius-lg`, `--shadow-card`, `--color-ember-dim` (open-loop count) | idle · hover |
| Header | custom | `--color-s1`, `--color-border`, h=54 px, `--z-header`, `--font-serif` (session title) | idle |
| "Where you stand" | inline + shadcn Popover | `--color-text-secondary`, `--color-ember-dim` (✎ icon), `--color-border-sub` (history list dividers) | idle · editing · history-open |
| View-history panel | shadcn Sheet | `--color-s2`, `--color-border-sub`, `--text-body-small-*` | open · closed |
| Composer | custom | `--color-s2`, `--color-border`, `--glow-input-focus`, `--color-ember` (send btn bg), `--color-ground` (send btn fg), `--radius-lg` | idle · focused · disabled (`costLocked`) |
| Sharpen-confirm field | shadcn Input | `--color-s2`, `--color-border`, `--glow-input-focus` | idle · editing · confirmed |
| Cost dot | custom | `--glow-cost-{normal,near,locked}`, `--color-node-settled`, `--color-ember`, `--destructive` | normal (<$1.60) · near (≥$1.60) · locked ($2.00) |
| Safety-note card | custom | `--color-safety-note`, `--color-s2`, `--color-border-sub`, `--text-small-*` | idle |
| Off-map chip | shadcn Badge | `--color-s3`, `--color-border`, `--color-ember-dim`, `--text-caption-*` | idle · accepted · dismissed |
| Export / Import | shadcn Button | `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground` | idle · loading |
| Overview toggle | shadcn Button | `--color-s3`, `--color-border`, `--radius-sm`, `--color-ember-dim` (active state) | idle · active (fitView) |
| Modal / Sheet | shadcn Dialog + Sheet | `--color-s2`, `--shadow-modal`, `--z-modal`, `--color-border` | open · closed |
| Empty states | custom | `--color-text-muted`, `--color-text-ghost`, `--text-body-*` | idle |

#### (b) Artifact templates — all twenty

★ = v1 build. After this table every phase-2 template is a pure build task with zero design decisions remaining.

| Template | Interactive primitives | Reveal / feedback states | Note |
|---|---|---|---|
| **slider-sim** ★ | `--slider-*`, `--bar-*`, `--refline-*`, `--color-sev-*` | headline + detail swap per segment (`--duration-medium` + `--ease-default`); bar color = current segment | Segment colors from `--color-sev-{safe,warn,caution,danger,crisis}`; each `outcomes[].atOrBelow` is a piecewise breakpoint |
| **predict-reveal** ★ | option buttons, `--feedback-correct-*`, `--feedback-incorrect-*` | chosen option flashes `--feedback-incorrect-*`; correct flashes `--feedback-correct-*`; `reveal` + `whyYourGuessWasReasonable` fade via `--reveal-*` | Choice locked on click; no undo |
| **before-after** ★ | `--tab-*`, `--tab-crossfade` | body swaps on tab click with `--duration-crossfade` (150 ms) + `--ease-default` crossfade | Both labels always visible; only body animates |
| **evidence-cards** ★ | `--drag-card-*`, `--drop-zone-*` | cards flash `--feedback-correct/incorrect-*` per `supports` value; `verdict` block fades via `--reveal-*` | After all cards placed; `--drop-zone-border-active` on hover |
| **timeline** ★ | `--timeline-track`, `--timeline-marker-*`, `--timeline-expanded-*` | tapped markers switch to `--timeline-marker-tapped`; `--timeline-pattern-*` block; `--reveal-*` | "Reveal pattern" button fires if not all markers tapped |
| **tradeoff** ★ | `--tradeoff-panel-*` (both identical pre-pick), `--tradeoff-chosen-*` | unchosen fades to `--tradeoff-unchosen-opacity`; `--tradeoff-insight-*` block; `--reveal-*` | Unchosen consequences shown alongside chosen after pick |
| **draw-your-guess** | `--sketch-user-*` (canvas), `--chart-*` | `--sketch-actual-stroke` line overlaid on Reveal click; `reveal` text via `--reveal-*` | `--sketch-canvas-bg` ghosts the hidden x-range; known portion renders as solid line first |
| **scale-ladder** | `--ladder-*`, `--bar-track`, `--chart-*` | ratio label appears on bar tap; `--reveal-*` | `--ladder-subject-fill` = ember; component applies log scale when value range > 3 orders of magnitude |
| **base-rate-box** | `--icon-{true/false}-{positive/negative}` icon array | user input → correct fraction highlighted; `insight` + `intuitiveMisread` via `--reveal-*` | 4 quadrant colors; Zod sum refine: all counts ≤ 10,000 |
| **feedback-loop-stepper** | `--loop-node-*`, `--loop-arrow-*` | active node advances with `--loop-node-active-*`; `--loop-punchline-*` after full cycle; `--reveal-*` | `loopType` "reinforcing"/"balancing" frames punchline copy only |
| **distribution-vs-anecdote** | `--dot-*`, `--chart-*` | `--dot-anecdote` dot appears with callout; `detail` + `insight` via `--reveal-*` | Bulk distribution renders first; anecdote overlaid on "Show [label]" click |
| **rank-the-list** | `--drag-card-*`, `--rank-delta-*` | items animate to correct positions; `--rank-delta-{up,down,correct}` badge per item; `insight` via `--reveal-*` | Generator must NOT pre-sort items in correct order |
| **odds-calibrator** | `--slider-*` (0–100%), `--confidence-fill`, `--confidence-{over,under}-fill` | `isTrue` shown prominently; calibration-zone label; `reveal` + `calibrationNote` via `--reveal-*` | Over/underconfident secondary line when gap > threshold |
| **compounding-clock** | `--curve-{1,2,3}-stroke`, `--chart-*`, `--refline-*`, `--curve-cursor` | all lines draw left→right ~2 s on mount; drag cursor reads values at any point; final values labeled via `--reveal-*` | `color?` prop overrides `--curve-*` per scenario |
| **survivorship-filter** | `--funnel-*` | stage-by-stage advance; survivor bar switches to `--funnel-survivor-fill`; `insight` via `--reveal-*` | Bar widths proportional to `surviving` counts |
| **steelman-duel** | `--duel-panel-*` (equal weight pre-commit), `--duel-leans-*` | `--duel-synthesis-*` block after pick; `consensusLeans` final labeled line; `--reveal-*` | Both panels visually identical until user commits; equal weight is the design requirement |
| **anatomy-labeler** | `--region-*` overlays, `--region-arrow-stroke` connections | click → `--region-active-ring` + `--region-panel-*` description panel; `--reveal-*` | `fillColor` from Generator props; `--region-*` tokens cover interaction states only |
| **counterfactual-fork** | `--fork-actual-*` (solid), `--fork-counter-*` (dashed), `--fork-point-*`, `--fork-event-*` | actual branch tapped first; counterfactual branch revealed second; `insight` via `--reveal-*` | Both branches 3–5 events; insight appears after both explored |
| **budget-allocator** | `--alloc-*`, `--slider-*` (sum enforced = 100) | bars animate to `actualPercent`; `--alloc-delta-{over,under}` label per category; `insight` via `--reveal-*` | Proportional re-adjustment across sliders enforced in component |
| **threshold-hunt** | `--threshold-*`, `--slider-*` | above/below feedback per probe; `--reveal-*` after `revealTolerance` or 6 probes; threshold marked on range bar | `belowLabel`/`aboveLabel` shown on feedback; range bar uses `--threshold-{above,below}-bg` zones |

**Home (map shelf):** a returning user (any map exists for the local `userId`) lands on a simple shelf — one card per map: held question, count of glowing (open) loops, **the brightest open loop named outright** (from `resumeSummary` — the card is itself a hook, not a menu item), "Where you stand" one-liner when set, last-visited date. After the user's 3rd session, a card gains one more line: *"Your guide has noticed: [one styleNote from the user model]"* — the personalization, made visible. Clicking a card starts a new session on that map (the return-turn-1 flow, §5); a primary "bring a new question" button starts onboarding. The shelf footer has **Export / Import** (round-trips all user data as one JSON file — the guard against localStorage loss, stated plainly: "your maps live in this browser; export to keep them"). First-time users skip the shelf entirely.

**Layout (desktop):** header (topic title · held question · **"Where you stand: …" one-liner when `currentView` is set, with its as-of date, a ✎ edit affordance (typing a replacement writes a new `ViewSnapshot`), and a small history icon that opens the dated list of all `ViewSnapshot`s — the trail, §5.7 PRD** · cost-meter dot · Conductor toggle) · left pane **chat** (~55%) · right pane **map** (~45%) · Conductor pane as a bottom drawer overlaying the map pane when open. Mobile: tab switch between Chat and Map; Conductor inside a sheet. Desktop-first; mobile must be usable, not polished.

**Chat:** streamed markdown; artifact tiles render inline as cards (locked → shimmer "building…" → unlocked with template UI inline; expandable to a modal). The input is never disabled.

**Map (React Flow):** custom node component, four visual states — `frontier`: dashed border, 50% opacity · `current`: solid + accent ring · open loop: soft pulse glow on the node edge · `settled`: solid, muted, small ✓. Node click = recenter conversation offer ("Pull this thread?") — it sends a prefilled user message; the map is a view, it never bypasses the Tutor. The node context menu also offers **soft-close** on stale open loops ("I've settled this elsewhere" → `closedBy: "user"`, §6.4). **Stale-glow decay:** loops with `lastTouchedAt` older than 14 days pulse at 50% opacity — an old question dims from invitation toward memory instead of nagging. New nodes animate in (fade + 0.95→1 scale, 400 ms). Auto-layout: `dagre` tree, root at left. Viewport eases to keep current node + children in frame. **Overview toggle:** one control fits the entire map in view (React Flow `fitView`), rendering slim title-only nodes — so a 40-node month-two map stays readable as a shape, not a wall.

**Conductor pane:** header line: *"How the guide is adapting to you this session"* (frames the data as a feature, not telemetry). One row per turn: `turn # · signals (chips: "leaning in", "near click 0.8") · tools called · rationale`. Live-appends from `director_decision` SSE events. Footer: session stats (loops closed/chained/dangling, cost).

**Onboarding:** full-screen card → posture chips → question textarea ("surprise me" hides it) → sharpen-and-confirm line ("So the question is: … — right?") → transition: map pane fades in and seeds while turn 1 streams.

**"Surprise me" rotation (hardcoded array, served round-robin; each entry becomes the held question + turn-1 provoke hook):** 1) Why the price of eggs is a geopolitics story · 2) Why you can't tickle yourself · 3) Why Japan owes 260% of GDP and nothing happened · 4) The traffic jam that has no cause · 5) Why password rules make passwords weaker · 6) Did medieval peasants really work fewer hours than you? · 7) Why planes have gotten slower since 1960 · 8) The country that abolished its army and got safer. **From the user's 3rd session onward**, a Haiku call picks the unused entry best matching the user model's `interests` (round-robin fallback when nothing fits) — surprise-me gets personal as the model fills in.

## 10. Artifact templates (locked set of twenty — six built in v1, fourteen in phase 2)

**v1 builds the first six** (`slider-sim`, `predict-reveal`, `before-after`, `evidence-cards`, `timeline`, `tradeoff`). The remaining fourteen are fully specified below and ship as phase 2 — a pure build task, no design work left. Until then, the Director/Generator prompts and the `spawnArtifact` TemplateId union include only the v1 six.

All templates are React components receiving `props` (Generator-filled JSON, validated with zod; invalid props → artifact silently dropped, logged as a `generation_failed` event). No template receives code, formulas, or executable expressions — relationships are expressed as data (piecewise breakpoints, lookup arrays, explicit datapoints). A component may derive computed values internally (e.g. a growth curve from a rate constant); the props supply only pure data. Zod schemas live in `src/templates/schemas.ts`; each template imports and exports its own slice. Validation happens at `artifact_ready` receipt on the client.

**Common fields (present at the top level of every template's props):**
```ts
{
  title:       string    // artifact headline; rendered in Fraunces in the card header
  caption?:    string    // source attribution or date context; rendered small/muted below the interactive
  closingLine: string    // one sentence: lands the payoff then raises the next question; rendered in Fraunces
  opensHook?:  string    // the next loop question this artifact deliberately opens (soft hint to the Director)
}
```

---

### `slider-sim`
**Delivers:** feel a continuous variable's relationship to an outcome; crossing a threshold becomes visceral.

**Props:**
```ts
{
  // common fields +
  variable: {
    label:   string   // axis/thumb label, e.g. "Average interest rate"
    min:     number
    max:     number
    step:    number
    unit:    string   // appended after the displayed value, e.g. "%"
    initial: number   // starting thumb position; must be between min and max
  }
  outcomes: Array<{
    atOrBelow: number   // upper bound of this segment; component shows this entry when value ≤ atOrBelow
    headline:  string   // bold text ≤10 words, shown while value is in this segment
    detail:    string   // 1–2 sentences of context shown below the headline
  }>                    // 2–5 entries; must be sorted ascending; last entry's atOrBelow must equal max
  referenceLines?: Array<{
    value: number
    label: string       // e.g. "Defense budget threshold"; rendered as a labeled tick on the slider track
  }>
}
```
**Interaction:** user drags the thumb; `headline` and `detail` update immediately per the current segment; reference lines render as labeled vertical ticks on the track.

**Example:** interest-rate risk — rate 1–15%, three segments (sustainable / warning zone / crisis), reference line at the interest-cost-equals-defense-budget crossing.

---

### `predict-reveal`
**Delivers:** catch a wrong intuition in the act — the moment you click the wrong option and see the correct one is the click.

**Props:**
```ts
{
  // common fields +
  question:                  string     // the posed question, 1 sentence
  options:                   string[]   // exactly 3 or 4 answer choices
  correctIndex:              number     // 0-based index into options
  reveal:                    string     // shown after answer; 1–3 sentences explaining why the correct answer is correct
  whyYourGuessWasReasonable: string     // shown alongside reveal; 1–2 sentences validating the wrong intuition
}
```
**Interaction:** user clicks one option → choice locked → correct option highlighted green, chosen wrong option highlighted red → `reveal` and `whyYourGuessWasReasonable` fade in below.

**Example:** minimum wage — four positions from "always increases unemployment" to "never does," correct index = 1 (modest context-dependent rise at typical magnitudes).

---

### `before-after`
**Delivers:** a reframe — the same situation looks entirely different from a different vantage.

**Props:**
```ts
{
  // common fields +
  before: {
    label: string   // tab label, e.g. "The intuitive framing"
    body:  string   // prose, 2–4 sentences
  }
  after: {
    label: string   // e.g. "The accurate framing"
    body:  string
  }
}
```
**Interaction:** two-tab toggle; both labels always visible; body swaps with a 150 ms crossfade; no state beyond which tab is active.

**Example:** vaccine side-effect risk — before: "1 in 1 million chance of a side effect," after: "You are 200× more likely to have that side effect from the disease itself."

---

### `evidence-cards`
**Delivers:** actively weighing a claim rather than passively receiving a verdict — the sorting effort makes the nuance stick.

**Props:**
```ts
{
  // common fields +
  claim: string       // the proposition being weighed, 1 sentence
  cards: Array<{
    headline: string    // ≤8 words; the evidence item name
    body:     string    // 1–2 sentences of detail
    supports: boolean   // true = for the claim; false = against
  }>                    // 3–6 cards; Generator must NOT pre-sort by supports value
  verdict: string       // synthesis shown after user finishes sorting, 1–2 sentences
}
```
**Interaction:** cards render in Generator-provided order in a neutral zone; user drags each card into a "Supports" pile or "Challenges" pile; after all cards are placed, `verdict` is revealed with a correct-sort overlay (cards flash green/red per their actual `supports` value).

**Example:** "does social media cause teen depression?" — 5 mixed-evidence cards (correlation data, reverse-causation study, longitudinal evidence, platform-specific finding, null result).

---

### `timeline`
**Delivers:** "this has happened before" — pattern recognition across history, the present feels less unique.

**Props:**
```ts
{
  // common fields +
  events: Array<{
    year:       number    // positive = CE, negative = BCE; used for ordering and axis positioning
    yearLabel?: string    // display override for approximate or non-Gregorian dates, e.g. "c. 1300 BCE"
    label:      string    // ≤8 words; the event name shown on the track
    detail:     string    // 1–2 sentences shown on tap/click
  }>                      // 4–10 events; need not be pre-sorted (component sorts by year)
  pattern: string         // the punchline connecting the events; revealed after all events are tapped or user presses "Reveal pattern"
}
```
**Interaction:** horizontal scrollable track with event marker dots; user taps each marker to expand its `detail`; after all markers are tapped (or a "Reveal pattern" button is pressed), `pattern` appears in a highlighted block at the bottom.

**Example:** US debt-ceiling crises — 8 events from 1917 to 2023, pattern: "Resolved every time, always at the last moment — so far."

---

### `tradeoff`
**Delivers:** there is no free lunch — every choice has real costs, and picking one makes the other's costs visible.

**Props:**
```ts
{
  // common fields +
  scenario: string   // 1–2 sentences framing the decision
  optionA: {
    label:        string     // ≤6 words naming the choice
    consequences: string[]   // 2–4 consequences; each ≤12 words
  }
  optionB: {
    label:        string
    consequences: string[]
  }
  insight: string    // the non-obvious synthesis shown after user picks, 1–2 sentences
}
```
**Interaction:** user picks Option A or B; the unchosen option's consequences are then shown alongside the chosen option's; `insight` appears below both columns.

**Example:** central bank rate decision — raise (lower inflation, higher unemployment, stronger currency, corporate debt stress) vs. hold (persistent inflation, asset-price inflation, currency weakness, political pressure).

---

### `draw-your-guess`
**Delivers:** drawing your intuition exposes it — the gap between your sketch and the actual trend is the click. Inspired by the NYT "You Draw It" pattern.

**Props:**
```ts
{
  // common fields +
  xLabel: string    // x-axis label, e.g. "Year"
  yLabel: string    // y-axis label, e.g. "% of adults who smoke"
  xUnit?: string    // optional unit appended to x-axis tick labels
  yUnit?: string    // optional unit appended to y-axis tick labels
  knownPoints: Array<{
    x: number   // x-axis value (e.g. 1950)
    y: number   // y-axis value
  }>             // ≥3 points forming the revealed left portion of the series; sorted ascending by x
  hiddenPoints: Array<{
    x: number
    y: number
  }>             // ≥3 points forming the actual hidden right portion; all x values must be > max(knownPoints[].x); sorted ascending
  reveal: string  // 1–2 sentences explaining the actual trend shown after reveal
}
```
**Interaction:** `knownPoints` render as a solid line; the `hiddenPoints` x-range shows as an empty canvas labeled "Draw your guess"; user clicks and drags to sketch a freehand path; a "Reveal" button overlays the actual `hiddenPoints` line in the ember accent color; `reveal` text appears below the chart.

**Example:** global child mortality — known: 1800–1960 (roughly stable, high), hidden: 1960–2020 (steep fall that almost everyone underestimates in magnitude).

---

### `scale-ladder`
**Delivers:** comprehend an unfamiliar magnitude by stacking it against a ladder of familiar reference points.

**Props:**
```ts
{
  // common fields +
  subject: {
    label: string   // what is being measured, e.g. "US national debt"
    value: number   // in the shared unit below
    unit:  string   // e.g. "dollars" or "kg of CO₂"
  }
  rungs: Array<{
    label:  string   // familiar reference, e.g. "Annual US GDP"
    value:  number   // in the same unit as subject.unit
    emoji?: string   // optional visual anchor shown next to the label, e.g. "🏛️"
  }>                 // 3–6 rungs; Generator must provide them sorted smallest-to-largest by value
}
```
**Interaction:** vertical bar chart where bar widths are proportional to value (log scale optional when range spans >3 orders of magnitude — component decides); the subject bar is highlighted in the ember accent color; the component computes and renders a ratio label per rung (e.g. "34× GDP"); user taps any bar for its label detail.

**Example:** "how much is a trillion dollars?" — subject: US national debt ($33T); rungs: annual federal budget ($6.5T), US GDP ($26T), global GDP ($100T), estimated total global wealth ($454T).

---

### `base-rate-box`
**Delivers:** base-rate confrontation — the visceral collision between a test's apparent accuracy and the true posterior probability.

**Props:**
```ts
{
  // common fields +
  scenario:        string   // 1 sentence framing the conditional-probability question, e.g. "You test positive for a rare disease."
  populationLabel: string   // display string for the total represented, e.g. "1,000 people"
  cells: {
    truePositive:  { count: number; label: string }   // has condition AND tests positive
    falsePositive: { count: number; label: string }   // no condition AND tests positive
    trueNegative:  { count: number; label: string }   // no condition AND tests negative
    falseNegative: { count: number; label: string }   // has condition AND tests negative
    // Zod refine: all four counts must sum to a single integer ≤ 10,000
  }
  question:         string   // the conditional question posed to the user, e.g. "What's the chance you're actually sick?"
  intuitiveMisread: string   // what most people wrongly answer and why, 1 sentence
  insight:          string   // the correct posterior (truePositive ÷ (truePositive + falsePositive)) stated plainly, 1–2 sentences
}
```
**Interaction:** a 2×2 grid renders as a proportional icon array (grid of person-icons, each quadrant a distinct color); user is asked `question` and either types a number or selects a range; then `intuitiveMisread` and `insight` appear, with the correct fraction highlighted in the icon array.

**Example:** mammography screening — 1,000 women: 9 true positive, 1 false negative, 89 false positive, 901 true negative; question: "You got a positive result — what's the chance you have cancer?"; correct answer: 9 ÷ 98 ≈ 9%.

---

### `feedback-loop-stepper`
**Delivers:** feel how a causal cycle amplifies or self-corrects — the mechanism behind bank runs, viral spread, and homeostasis.

**Props:**
```ts
{
  // common fields +
  loopType:          "reinforcing" | "balancing"   // controls the framing of the punchline
  startingCondition: string   // 1 sentence setting the scene, e.g. "Imagine bank deposits fall slightly."
  steps: Array<{
    id:          string    // short stable key, e.g. "deposit_drop"; used for connection rendering
    label:       string    // node label shown in the diagram, ≤6 words
    description: string    // what happens at this step, 1 sentence
    effect:      "increases" | "decreases" | "enables"   // arrow label from this step to the next
  }>                       // 4–7 steps; the last step's arrow connects back to steps[0]
  punchline: string        // what the loop produces over time, 1–2 sentences; shown after completing the full cycle
}
```
**Interaction:** circular SVG diagram of labeled nodes; user clicks "Next Step" to advance the active highlight around the circle, revealing each step's `description` and its `effect` arrow; after the final step closes the loop, `punchline` appears; user may run the cycle a second time to feel the amplification.

**Example:** bank run — 5 steps: deposits fall → bank sells assets → asset prices drop → bank appears weaker → more withdrawals → (loops back); loopType: reinforcing.

---

### `distribution-vs-anecdote`
**Delivers:** seeing the full distribution exposes how unrepresentative the famous case is — the anecdote is a real data point, just not a typical one.

**Props:**
```ts
{
  // common fields +
  xLabel: string    // x-axis label, e.g. "Annual income (USD)"
  xUnit?: string    // optional unit appended to tick labels, e.g. "$k"
  dataPoints: Array<{
    value: number   // x-axis position (bucket center)
    count: number   // number of observations in this bucket, used for dot-stacking height
  }>                // 8–20 buckets spanning the full distribution; values need not be evenly spaced
  anecdote: {
    value:  number   // x-axis position of the famous case; typically in an extreme tail
    label:  string   // name of the case, e.g. "Elon Musk" or "The Black Death"
    detail: string   // 1 sentence on why this case dominates the narrative
  }
  insight: string    // what the distribution reveals that the anecdote hides, 1–2 sentences
}
```
**Interaction:** dot plot renders first showing only the distribution; user clicks "Show [anecdote.label]" → an accent-colored dot appears at `anecdote.value` with a callout line (often in an extreme tail); `anecdote.detail` and `insight` fade in below.

**Example:** CEO compensation — S&P 500 pay distribution; anecdote: Elon Musk's $56B Tesla grant; insight: the median CEO package is ~$15M — Musk sits 3,700× above the median, invisible in most reporting.

---

### `rank-the-list`
**Delivers:** the gap between your intuitive ranking and the actual one is the click — ordinal surprises land harder than single-point corrections.

**Props:**
```ts
{
  // common fields +
  question: string   // ranking instruction, e.g. "Rank these countries by life expectancy, highest first."
  items: Array<{
    id:      string   // stable key referenced in correctRanking
    label:   string   // ≤6 words shown during drag-to-rank
    detail?: string   // shown only after reveal, ≤1 sentence of context
  }>                  // 4–7 items; Generator must NOT pre-sort them in correct order
  correctRanking: string[]   // item ids in correct order; index 0 = rank 1 (best/highest/first per the question)
  insight: string            // what the correct ranking reveals about the topic, 1–2 sentences
}
```
**Interaction:** items render in Generator-provided order; user drags to reorder; user clicks "Submit ranking" → items animate to their correct positions; a delta arrow (↑2, ↓1, ✓) and optional `detail` appear on each item; `insight` appears below.

**Example:** murder rate ranking — USA, Japan, Brazil, UK, Mexico; most people underrank Brazil (#1) and overrank USA (#4 of 5).

---

### `odds-calibrator`
**Delivers:** epistemic calibration — the gap between how confident you felt and the actual truth of the claim; teaches that overconfidence is systematic, not personal failure.

**Props:**
```ts
{
  // common fields +
  claim:           string    // a falsifiable statement phrased so it is clearly either true or false, e.g. "Sharks kill more people annually than lightning."
  isTrue:          boolean   // whether the claim is actually true
  reveal:          string    // the correct answer with evidence, 1–3 sentences
  calibrationNote: string    // 1 sentence contextualizing the calibration result, e.g. "Studies find people are overconfident on surprising-sounding claims ~65% of the time."
}
```
**Interaction:** a large horizontal slider from 0–100% labeled "How confident are you this is TRUE?"; user drags to their confidence level and clicks "Reveal" → `isTrue` displayed prominently → `reveal` shown → `calibrationNote` appears; the component adds a secondary line ("you were in the overconfident zone" or "underconfident zone") if the user was >70% confident on a false claim or <30% on a true one.

**Example:** "Sharks kill more people annually than lightning" — isTrue: false (lightning kills ~2,000/year globally; sharks ~5); calibrationNote cites overconfidence research on surprising-sounding animal claims.

---

### `compounding-clock`
**Delivers:** feel the counter-intuitive power of exponential growth by watching different rates compound over the same period; the divergence between lines is the click.

**Props:**
```ts
{
  // common fields +
  unit:         string   // what is accumulating, e.g. "dollars" or "bacteria"
  initialValue: number   // starting quantity at time 0
  timeLabel:    string   // x-axis label, e.g. "Years" or "Doublings"
  timeSteps:    number   // number of periods to simulate; 10–50 recommended
  scenarios: Array<{
    rate:   number   // per-period growth rate as a decimal, e.g. 0.07 for 7%; component computes value[t] = initialValue × (1 + rate)^t
    label:  string   // e.g. "7% annual (stock market avg.)"
    color?: string   // optional hex color override for this scenario's line
  }>                 // 2–4 scenarios
  referenceValue?: {
    value: number
    label: string   // e.g. "10× starting amount"; rendered as a horizontal dashed rule
  }
}
```
**Interaction:** animated multi-line chart that draws all scenario lines simultaneously from left to right over ~2 s on mount; user can drag a vertical time-cursor to read off each scenario's value at any point; final values labeled at the right edge; reference line drawn as a dashed rule if provided.

**Example:** retirement savings — $10,000 initial, three scenarios (4% savings account, 7% index fund, 10% aggressive), 40 years, reference at "10× starting amount."

---

### `survivorship-filter`
**Delivers:** see the population that didn't make it through — only then does the visible group stop looking like destiny.

**Props:**
```ts
{
  // common fields +
  startLabel: string    // label for the full starting population, e.g. "All restaurants opened in NYC in 2010"
  startTotal: number    // total population at the top of the funnel; must equal stages[0].surviving + stages[0].dropped
  stages: Array<{
    label:      string   // who remains, e.g. "Still open after year 1"
    surviving:  number   // count that pass through this stage (must equal previous stage's surviving or startTotal for stage 0)
    dropped:    number   // count filtered out at this stage; surviving + dropped must equal the input to this stage
    dropReason: string   // ≤1 sentence: why most were filtered here
  }>                     // 3–5 stages
  visibleGroup: string   // label for the final survivors, e.g. "The restaurants we review on Yelp"
  insight:      string   // what you would wrongly conclude from seeing only survivors, 1–2 sentences
}
```
**Interaction:** funnel diagram; user clicks "Next stage" to advance; each stage reveals its surviving count as a proportional bar and `dropReason` as a caption; at the final stage the surviving bar is highlighted and labeled `visibleGroup`; `insight` appears below.

**Example:** WWII bomber armor — 100 aircraft sent on missions, staged by return/damage; insight: the planes that returned show damage where armor is NOT needed — the ones hit there didn't return.

---

### `steelman-duel`
**Delivers:** see that the other side has a real argument — the click is realizing the issue is genuinely contested, not a matter of one side being foolish.

**Props:**
```ts
{
  // common fields +
  question: string   // the contested claim or decision, 1 sentence
  sideA: {
    label:  string     // ≤8 words naming the position
    points: string[]   // 3–4 strongest honest arguments for this position; each ≤20 words
  }
  sideB: {
    label:  string
    points: string[]
  }
  synthesis:       string             // 2–3 sentences: what the evidence actually shows and where genuine tension remains
  consensusLeans?: "A" | "B" | "neither"   // optional: where expert/scientific consensus sits; shown as a final line after synthesis
}
```
**Interaction:** both sides rendered side-by-side with equal visual weight before user commits; user clicks "I lean A," "I lean B," or "I'm torn"; `synthesis` appears; `consensusLeans` shown (if provided) as a final labeled line after synthesis.

**Example:** "does foreign aid help or hurt developing economies?" — sideA: infrastructure/mortality gains, sideB: dependency/Dutch-disease/corruption evidence; synthesis: depends heavily on aid type and institutional context; consensusLeans: "neither" (genuinely contested among economists).

---

### `anatomy-labeler`
**Delivers:** spatial understanding — clicking the parts of a system reveals how they connect and what each does.

**Props:**
```ts
{
  // common fields +
  diagramLabel: string    // title shown above the SVG diagram
  viewWidth:    number    // logical SVG width (used as viewBox width), e.g. 800
  viewHeight:   number    // logical SVG height, e.g. 500
  regions: Array<{
    id:        string    // stable key referenced in connections
    shape:     "rect" | "circle"
    // Rect fields (all required when shape = "rect"):
    x?:  number; y?:  number; w?:  number; h?:  number
    // Circle fields (all required when shape = "circle"):
    cx?: number; cy?: number; r?:  number
    // All coordinate values must fit within viewWidth × viewHeight
    fillColor:   string   // hex color for the shape fill, e.g. "#e07040"
    label:       string   // always-visible pin label, ≤4 words
    description: string   // shown in a side panel on click, 1–2 sentences
  }>                      // 4–8 regions
  connections?: Array<{
    fromId:  string    // region id
    toId:    string    // region id
    label?:  string    // optional arrow label rendered at midpoint, ≤5 words
  }>
}
```
**Interaction:** SVG renders all regions as colored shapes with always-visible pin labels; user clicks any region → a description panel shows that region's `description`; connections render as labeled arrows between region centers; no region is pre-selected on load.

**Example:** human heart — four chambers as colored rectangles, two valves as circles, connections labeled "oxygenated blood" and "deoxygenated blood."

---

### `counterfactual-fork`
**Delivers:** feel the weight of a single decision by tracing two diverging timelines — what did and didn't happen.

**Props:**
```ts
{
  // common fields +
  forkPoint: {
    year:        string   // display string, e.g. "June 28, 1914" or "March 2020"
    description: string   // the decision or event that creates the fork, 1 sentence
  }
  actualPath: {
    label:  string   // e.g. "What happened"
    events: Array<{
      year:    string   // display string for the event's time
      outcome: string   // ≤15 words
    }>                  // 3–5 events in chronological order
  }
  counterfactualPath: {
    label:  string   // e.g. "If the Archduke had taken the alternate route"
    events: Array<{
      year:    string
      outcome: string
    }>                  // 3–5 events in chronological order
  }
  insight: string   // what the comparison reveals about causality or historical contingency, 1–2 sentences
}
```
**Interaction:** fork diagram with a shared root at `forkPoint`; user taps through `actualPath.events` (top branch) first; then the `counterfactualPath` branch is revealed and user taps through those events; `insight` appears after both branches are explored.

**Example:** penicillin — fork: Fleming notices a contaminated Petri dish (1928); actual: antibiotic era, millions saved; counterfactual: dish discarded, WWII casualty estimates roughly double, antibiotic resistance timeline shifts by decades.

---

### `budget-allocator`
**Delivers:** your intuition about how something is distributed is the artifact — the gap between your allocation and reality is the click.

**Props:**
```ts
{
  // common fields +
  question:   string   // e.g. "How does the US federal government spend each dollar?"
  totalLabel: string   // e.g. "100 cents of every federal dollar"
  categories: Array<{
    id:            string
    label:         string   // ≤5 words, e.g. "Defense"
    actualPercent: number   // the real share; all values must sum to exactly 100
    hint?:         string   // shown only after reveal, ≤1 sentence of context or the surprising fact
  }>                        // 4–8 categories
  insight: string           // what the real distribution reveals, 1–2 sentences
}
```
**Interaction:** user adjusts per-category sliders; component enforces sum = 100 by proportionally adjusting other sliders when one changes; user clicks "See reality" → all bars animate to `actualPercent`; delta labels appear on each bar ("+12 pts more than you guessed"); `hint` fades in per category; `insight` appears at bottom.

**Example:** "how big is the foreign aid slice?" — categories: Social Security, Medicare/Medicaid, Defense, Interest, Other mandatory, Discretionary non-defense, Foreign aid (actual: ~1%); most people guess 10–25%.

---

### `threshold-hunt`
**Delivers:** discovering a hidden threshold by binary search — you feel both the existence and the location of a tipping point, not just its value.

**Props:**
```ts
{
  // common fields +
  question:        string   // the threshold question, e.g. "At what annual income does day-to-day emotional wellbeing stop increasing?"
  unit:            string   // e.g. "$k/year" or "ppm CO₂"
  minValue:        number   // lower bound of the search range
  maxValue:        number   // upper bound
  thresholdValue:  number   // the actual threshold; must be strictly between minValue and maxValue; hidden during play
  belowLabel:      string   // ≤8 words: what is true below the threshold, e.g. "wellbeing rises with income"
  aboveLabel:      string   // ≤8 words: what is true above the threshold, e.g. "wellbeing plateaus"
  revealTolerance: number   // when the user's probe is within this distance of thresholdValue, "Close enough — reveal?" appears
  reveal:          string   // 1–2 sentences explaining the threshold and the mechanism behind it
}
```
**Interaction:** user sees the question, unit, and range; a coarse slider or number input lets them pick a probe value; clicking "Test" returns "Below the threshold" or "Above the threshold" (or the reveal prompt when within `revealTolerance`); after the reveal or after 6 probes (whichever comes first), the threshold is marked on a labeled range bar with `reveal` text below.

**Example:** income and wellbeing — minValue: 20, maxValue: 500 ($k/year), thresholdValue: 75, belowLabel: "each dollar buys measurable wellbeing," aboveLabel: "gains plateau," revealTolerance: 20; reveal cites Kahneman & Deaton (2010) and the Killingsworth (2021) update.

---

### Generator template-selection guidance

**Note for the implementing model:** the guidance below covers all 20 templates for reference, but the v1 `TemplateId` union — and therefore the Director's and Generator's selectable set — contains **only the v1 six** (`slider-sim`, `predict-reveal`, `before-after`, `evidence-cards`, `timeline`, `tradeoff`).

One-line "use when" per template, grouped by cognitive move, for reference in Director and Generator prompts.

**Intuition exposure** — when the loop question has a surprising or counterintuitive true answer:
- `predict-reveal` — use when the answer is clearly wrong if you don't already know the evidence (MCQ format fits)
- `draw-your-guess` — use when the loop question is about a trend the user has a gut-feel for
- `rank-the-list` — use when the loop question involves an ordering the user is likely to get surprisingly wrong
- `odds-calibrator` — use when the loop question is a true/false claim the user may be overconfident or underconfident about

**Threshold and relationship** — when the loop question asks "how much?" or "at what point does it matter?":
- `slider-sim` — use when there is a continuous driver with distinct qualitative regimes (piecewise outcomes)
- `threshold-hunt` — use when the payoff is the discovery of *where* a hidden tipping point sits

**Scale and magnitude** — when the loop question involves a quantity that is hard to feel:
- `scale-ladder` — use when the loop question requires grasping an unfamiliar magnitude through familiar comparators
- `compounding-clock` — use when the loop question is about exponential growth or the difference between rates over time

**Probability and statistics** — when the loop question involves conditional probability, distributions, or base rates:
- `base-rate-box` — use when the loop question involves a test, screening result, or conditional probability
- `distribution-vs-anecdote` — use when the loop question's intuitive answer is distorted by a famous outlier

**Causal structure** — when the loop question asks "why?" or "how does this system work?":
- `feedback-loop-stepper` — use when the loop question involves a self-reinforcing or self-correcting cycle
- `survivorship-filter` — use when the loop question's answer is hidden by who or what is not visible
- `anatomy-labeler` — use when the loop question is about how the spatial or structural parts of a system connect

**Comparison and reframe** — when the loop question involves a choice, a contrast, or a changed vantage point:
- `before-after` — use when the loop question is answered by reframing the same information differently
- `tradeoff` — use when the loop question is a decision with genuine costs on both sides
- `steelman-duel` — use when the loop question is genuinely contested and both sides have real evidence
- `counterfactual-fork` — use when the loop question involves what a single decision or event changed

**Evidence and allocation** — when the loop question requires weighing claims or understanding how a resource is split:
- `evidence-cards` — use when the user should actively sort mixed evidence rather than receive a pre-sorted verdict
- `budget-allocator` — use when the loop question is about how a resource or budget is actually distributed
- `timeline` — use when the loop question is best answered by seeing a pattern repeat across history

## 11. Safety & guardrails
1. **Binding floor** in the Tutor anchor (§7.1) — trusted system prompt, not reachable by any tool. Director output is wrapped in `<director_instruction>` and explicitly subordinated to the floor (soft mitigation; the hard boundary is that tools can't touch the system prompt).
2. **Post-turn check** (Haiku, async): reviews the Tutor's reply for (a) confident factual claims that look fabricated/wrong, (b) advice crossing the medical/legal/financial line, (c) missed distress signals. On flag: `safety_note` SSE event renders a small correction/care card under the reply, and the event is logged. Fail-open with logging (a missed check must never block the conversation at v1 scale).
3. `raiseCaution` may only add caution to a directive.
4. **Not v1:** mid-stream interruption/retraction, circuit breakers, moderation infra (no UGC is shared between users).

## 12. Sessions, signals & metrics
- **Session boundary:** 30 min without events → closed (lazily, on next request or beacon). Same map, new session on return.
- **Active time:** sum of inter-event gaps capped at 5 min each.
- **Computed per session:** `loopsClosed`, `loopsChained` (closed loops referenced by a later loop's `chainedFromLoopId` — §6.4 is the only definition), `loopsDangling`, active time, cost.
- **North star at v1 scale:** read qualitatively — Conductor pane per session + a `/stats` debug page listing sessions with the four numbers. No dashboards.
- **Signals into the Reader:** computed (reply latency vs. user's own baseline, message-length trend, artifact interactions) + judged (appetite, proximity). All logged to `events` regardless of use.

## 13. Cost model & ceiling
Per typical turn (cached anchor): Tutor (Sonnet 4.6, $3/$15 per MTok): ~2.5K in (mostly cache-read at ~$0.30/MTok) + ~350 out ≈ **$0.006–0.01** · Haiku calls (Reader + Director + post-turn, $1/$5): ≈ $0.002 · Generator job when fired: ≈ $0.003. **≈ $0.01–0.015/turn → a 30-turn session ≈ $0.30–0.50** (Opus Tutor flag: ~2×). Budget meter accumulates real `usage` from every response.
`Session.costUsd` is **incremented atomically after every API response** from its real `usage`; the threshold is read at the start of each turn. **Ceiling: $2.00/session.** At $1.60 the Director's payload flags it and the prompt biases toward closing. **At $2.00 (detected at turn start, before the Reader):** the pipeline takes a special branch — skip Reader and Director, abandon pending Generator jobs, send the Tutor one hardcoded directive ("close the session warmly in ≤2 sentences: the map keeps glowing and will be here tomorrow"), stream it, emit `done`, set `Session.costLocked = true`; the client reads `costLocked` and disables input until a new session. With the Opus Tutor flag the same mechanics apply but trigger roughly twice as fast (~15 turns, not ~30).

## 14. Prompt caching (one paragraph, that's all it needs)
Order: `tools → system → messages`. Tools (Director call) and the Tutor anchor are byte-stable; `cache_control` breakpoint on the anchor's last block; history is append-only within a session; the per-turn directive rides in the *final* message block so it never invalidates the prefix. Sonnet 4.6 minimum cacheable prefix is 2,048 tokens — the anchor is sized past it (§7.1) and turn-2 `cache_read_input_tokens > 0` is the regression test. At v1 scale this is hygiene, not economics.

## 15. Worked example — mechanical trace (turns 3 and 5 of the PRD §7 session)

| Step | Turn 3 | Turn 5 |
|---|---|---|
| Computed signals | latency ↓, length ↑ | latency ↓, confident assertion detected |
| Reader out | `{appetite: leaning_in, proximity: 0.3, justClosed: false}` | `{appetite: leaning_in, proximity: 0.75, justClosed: false}` |
| Director out | `setTutorMode("explain")`, `expandMap(n_holders, "deepen")` — rationale: "engaged but far; give the next layer underneath" | `setTutorMode("challenge")`, `spawnArtifact("slider-sim", n_interest, "when do interest payments actually become the problem?")` — rationale: "confident claim near the click; challenge it and let the slider land it" |
| SSE order | `director_decision` → `tutor_delta`* → `loop_state` → `map_update` (2 nodes) → `done` | `director_decision` → `tutor_delta`* → `loop_state` → `artifact_ready` → `done` |
| Persisted | decision row; 2 `MapNode` (frontier); events | decision row; `Artifact` (ready); turn-6 Reader will set `justClosed: true` → `Loop.closedAt`, node → `settled`, decision `outcome` backfilled |

## 16. Definition of done (one-shot acceptance checklist)
1. `npm install && npx prisma db push && npm run dev` with only `ANTHROPIC_API_KEY` set → working app.
2. Onboarding: all four postures reach a streaming first turn; sharpened question confirmed; map seeds within ~10 s without blocking chat.
3. Ten-turn conversation: Tutor streams every turn; Conductor pane shows a decision row per turn with signals + rationale; at least one `expandMap` and one `spawnArtifact` fire under natural play (`FORCE_ARTIFACT=true` env makes the Director spawn one on the next eligible turn, for deterministic acceptance testing).
4. All six v1 artifact templates render from sample props on a `/dev/artifacts` route and at least `slider-sim` + `predict-reveal` spawn live from an actual `spawnArtifact` call. (The fourteen phase-2 templates in §10 are not part of v1 acceptance.)
5. Loop lifecycle visible on the map: glow on open, settle on close.
6. Close the tab, return: same map, same node states; new session row; Profiler updated `user_models.data` (verifiable on the `/stats` debug page, which shows the model JSON + `updatedAt` alongside per-session metrics).
7. Cost meter accumulates real usage; ceiling behavior demonstrable with a lowered `SESSION_COST_LIMIT` env.
8. `director_decisions` rows contain signals, tools, rationale, the rendered directive, and backfilled outcomes — the future-policy training set exists from day one. (Each session's final decision keeps `outcome = null`; that's expected, not a failure.)
9. Cache regression: turn 2 logs `cache_read_input_tokens > 0`.
10. README: what this is (PRD §1–2), the metric stance (PRD §4, two sentences on why not session length), clone-and-run, and a Conductor pane screenshot.
11. Return flow: end a session, come back — land on the map shelf; resuming opens with a welcome-back beat that names a real open loop (verify `Map.resumeSummary` was written and the `<resume>` block was injected).
12. View ledger: on a challenge-a-belief map, a genuine synthesis answer writes `Map.currentView` + a `ViewSnapshot` (a deflection writes nothing); "Where you stand" renders in the header with its as-of date; the history icon opens the dated snapshot list; the ✎ edit writes a new snapshot.
13. Packaging: repo is git-initialized with an MIT `LICENSE`; README includes a screenshots section with a placeholder for a ~90 s session recording (captured manually post-build — placeholder link is acceptable at code-complete).
14. Long-map hygiene: the overview toggle fits the whole map in view; a loop with `lastTouchedAt` older than 14 days renders the dimmed glow; node-context-menu soft-close works and records `closedBy: "user"`.
15. Shelf: cards name the brightest open loop; the "your guide has noticed" line appears once 3 sessions exist; Export downloads one JSON of all user data and Import restores it on a fresh profile.
16. Cost lock: with a lowered `SESSION_COST_LIMIT`, the ceiling branch fires at turn start — wrap-up line streams, `done` emits, `costLocked` disables input; no Reader/Director calls are made on that turn.
17. **The pre-written contract suite passes:** `npx vitest` under `LLM_MODE=mock` runs the 73 spec-derived tests in `tests/` green. The implementer may ADD tests but must never modify existing ones (`git diff` on `tests/` stays clean, excluding additions).

## 17. Contract clarifications (from the test-author review — answers to `tests/GAPS.md`)

- **G-01 (chain window):** "within 2 turns" = turn numbers (count of user messages, §5.1): `turnOpened − turnOfClose ≤ 2`, **same session only**.
- **G-02 (`loopsDangling`):** loops *opened during this session* that are still open at session end.
- **G-03 (soft-close never chains):** a user-closed loop can never be the *source* of a chain — no later loop may set `chainedFromLoopId` to it (a soft-close is not a click). It may itself carry a `chainedFromLoopId` from before.
- **G-04 (`DirectorDecision.outcome` shape):** `{ nextAppetite: string, nextProximity: number, nextJustClosed: boolean }` — copied from the following turn's Reader output.
- **G-05 (`DirectorDecision.turn`):** the turn number of the turn the decision was made in (count of user messages *including* the current one).
- **G-06 (seeding):** one `generator-map` call with a seed-variant prompt allowed to return 4–6 nodes, all `parentId = root`.
- **G-07 (`synthesisFired` inheritance):** inherited `true` only in the unanswered case (previous session fired synthesis and wrote no `ViewSnapshot`); otherwise every new session starts `false`.
- **G-08 (surprise-me picker, session 3+):** runs in the `sharpen` role/slot at onboarding — input: unused rotation entries + user-model `interests`; output: the pick. No new role.
- **G-09 (Profiler fallback edge):** 1 open loop → use it alone; 0 open loops → `resumeSummary = "Fresh start — no open threads; offer something new."`
- **G-10 (`activeSeconds`):** sum of gaps between *consecutive `Event` rows of any type*, each gap capped at 5 min.
- **G-11 (off-map turns):** no proximity write, no `lastTouchedAt` stamp — no loop is being worked.
- **G-12 (`/api/session/end` response):** `200 {sessionId, loopsClosed, loopsChained, loopsDangling, activeSeconds, costUsd}`.
- **G-13 (near-ceiling signal):** map context gains `costNearCeiling: boolean` (true at ≥ $1.60).
- **G-14 (`loopsChained` scoping):** the per-session rollup counts chains where **both ends are in this session**; cross-session chains remain visible in the `Loop` table but are not in session rollups.
- **G-15 (test endpoints in prod):** when `LLM_MODE ≠ mock`, the `/api/_test/*` routes are not mounted — plain 404.
- **G-16 (retry policy):** one retry on schema-validation failure applies to **all structured Haiku calls** (Reader, Generator, Profiler, Safety). The Director (tool use) gets no retry — code validation + defaults (§5.4). Critical-path failure after retry: Reader → proceed with neutral signals (`appetite: "neutral"`, proximity unchanged, no close) + log; Director → default `setTutorMode("explain")` + log.

## 18. Test harness (build requirement)

The spec-derived contract suite in `tests/` (73 tests, written before any implementation; see `tests/README.md`) requires this seam — it is part of v1, not optional:

- **`LLM_MODE=mock`**: the server's **single LLM-call module** routes every outbound call to in-process FIFO queues; the Anthropic SDK is never invoked. Roles: `sharpen, reader, director, tutor, generator-map, generator-artifact, profiler, safety`.
- **Control endpoints (mounted only under mock; 404 otherwise):** `POST /api/_test/enqueue` `{role, ...response}` (per-role FIFO) · `POST /api/_test/reset` (clear queues) · `POST /api/_test/db/reset` (FK-safe truncate of all tables).
- **Queue-empty semantics:** `reader`/`director`/`tutor` empty = test bug → 500 + `mock_queue_empty` Event; all other roles return safe defaults.
- **Tutor mock streaming:** splits `text` into 3 chunks → consecutive `tutor_delta` events (~5 ms apart); its `usage` flows through the real pricing constants into `Session.costUsd` (so cost tests exercise production accounting).
- **DB:** global test setup creates a throwaway SQLite file + `prisma db push`; resets via the endpoint between tests.

Architectural implication the implementer must honor: **all seven LLM call types go through one module** (e.g. `src/lib/llm.ts`) — that's the seam.

# Worldview v2 — Spec Gaps & Ambiguities

Found during test-writing (each gap is an open question the implementer must answer or the spec must close). Tests cover only what IS specified; where the spec is silent a test is not written — but this document logs the silence so it can be decided before it becomes a bug.

---

## G-01 — "Within 2 turns" of a close: which turn counter?

**Section:** §6.4
**Specification says:** "a loop opened within 2 turns of a close gets `chainedFromLoopId`"
**What's unspecified:** Is "2 turns" measured by the session's overall user-message count, or by the delta between `DirectorDecision.turn` values? If a user sends three messages in quick succession while the pipeline serializes them, the turn counter may advance differently than wall time.
**What's needed:** Confirm the turn counter used is `DirectorDecision.turn` (= count of user messages in the session at decision time), and "within 2 turns" means `currentTurn - closedTurn <= 2`.

---

## G-02 — `loopsDangling` computation

**Section:** §8 (Session model), §12
**Specification says:** Session has a `loopsDangling` column and the metric is listed, but §12 only defines `loopsChained`. `loopsDangling` is never formally defined.
**What's unspecified:** Is "dangling" = open loops at session end? Open loops that were opened during this session but not closed? Loops where the node was never `current` again after the loop opened?
**What's needed:** A precise SQL-expressible definition. Likely candidate: `closedAt IS NULL AND openedAt < session.endedAt` (i.e., every loop that was open when the session ended). Also, the Director prompt uses "dangling loops >= 3 → close before you open" as a policy, which implies dangling is observable at turn time (not just at session end) — clarify whether `loopsDangling` is a session-end metric only or also a live counter.

---

## G-03 — Soft-close and chaining: which side is excluded?

**Section:** §6.4
**Specification says:** "soft-close sets `closedBy: 'user'` and never chains"
**What's unspecified:** "Never chains" is ambiguous about direction. Does it mean:
(a) a loop opened AFTER a soft-close never gets `chainedFromLoopId` pointing at the soft-closed loop (i.e., soft-closed loops are not eligible as chain origins), OR
(b) the soft-closed loop itself never gets a `chainedFromLoopId` set (i.e., soft-closed loops cannot be the result of a chain), OR
(c) both?
The most natural reading is (a): soft-close cannot start a chain because the user "settled it elsewhere," meaning the curiosity thread ended voluntarily, not via a payoff that opened the next hook. The test is written with interpretation (a). Confirm.

---

## G-04 — `DirectorDecision.outcome` JSON shape

**Section:** §8
**Specification says:** `outcome Json? // backfilled next turn: did appetite/proximity improve? justClosed?`
**What's unspecified:** The exact JSON schema for `outcome`. The comment is a one-liner description, not a type definition. Tests check that `outcome` is non-null on non-final turns, but cannot assert on field names without a defined shape.
**What's needed:** The precise outcome record structure, e.g.:
```json
{ "appetiteImproved": boolean, "proximityImproved": boolean, "justClosed": boolean }
```
Impacts the future bandit training set (§6.3 decision log).

---

## G-05 — Turn number in `DirectorDecision.turn`: before or after counting the current message?

**Section:** §8, §5 step 1
**Specification says:** "turn = count of user messages at decision time" and §5 step 1 says "turn number = count of user messages in this session"
**What's unspecified:** Is the user message that triggered this pipeline already counted? I.e., is turn 1 when the Director runs on the very first user message? Tests assume yes (first user message → Director.turn = 1). Confirm.

---

## G-06 — Seed job scope: what does it generate?

**Section:** §4, §5 step 1
**Specification says:** `/api/onboard` "kicks off seed generation (fire-and-forget)" and the spec says "seeding of 4–6 frontier nodes" (§5, return-turn-1 section)
**What's unspecified:** Is the seed job a `generator-map` call (expansion from the root node)? Or does it call something else? The `pendingSeedJobs` registry is the tracking mechanism, but the spec doesn't explicitly say "onboard calls generator-map once." The test assumes it is one `generator-map` call. Confirm.

---

## G-07 — Synthesis re-arm: is `synthesisFired` ever reset?

**Section:** §5 step 5, §5 step 1
**Specification says:** "the new session inherits `synthesisFired = true` when the old one fired synthesis without capturing an answer (never re-ask an unanswered question)"
**What's unspecified:** If the old session DID capture a synthesis answer (`synthesisAnswer` non-null), does the new session inherit `synthesisFired = true` or `false`? If `true`, synthesis never fires again on any return session. If `false`, synthesis could fire again on a future session after enough new loops close. The "never re-ask an unanswered question" phrasing implies only unanswered deflections propagate `synthesisFired`. The test is written with this interpretation (only deflections propagate). Confirm.

---

## G-08 — Surprise-me and the "from 3rd session onward" Haiku pick

**Section:** §9
**Specification says:** "From the user's 3rd session onward, a Haiku call picks the unused entry best matching the user model's interests"
**What's unspecified:** Is "3rd session" the 3rd session on ANY map, or the 3rd time the user has chosen surprise-me? Also, what is the Haiku prompt for this selection? No separate role is defined for it in §7. No test is written for this Haiku call because its role name/prompt is unspecified.
**What's needed:** Role name (e.g., `surprise-selector`) or confirmation that it reuses `director` or a new role.

---

## G-09 — Profiler fallback: what if fewer than 2 open loops exist?

**Section:** §5 step 8
**Specification says:** "code writes a minimal fallback summary from the two open loops with highest proximity"
**What's unspecified:** If there are 0 or 1 open loops when the Profiler fails, what does the fallback write? The test only covers the "2+ open loops" case. The spec is silent on the degenerate cases.
**What's needed:** Clarify fallback behavior for 0 open loops (empty summary? "No open loops."?) and 1 open loop (use just that one?).

---

## G-10 — `activeSeconds` computation: what counts as an "event"?

**Section:** §12
**Specification says:** "Active time: sum of inter-event gaps capped at 5 min each"
**What's unspecified:** "Event" here is ambiguous — it could mean any row in the `events` table, or specifically user-initiated actions (messages sent), or SSE events. The cap (5 min per gap) handles inactivity windows, but the start/end anchor points are not defined.
**What's needed:** Define "event" for active-time purposes (likely: user message timestamps, i.e., `Message.createdAt` where `role='user'`).

---

## G-11 — Off-map turns and loop proximity update

**Section:** §6.4, §5 step 3
**Specification says:** "when the Reader returns `conversationNodeId: null`, no node transitions occur and no loop opens. The Director must not call `expandMap`/`spawnArtifact` that turn"
**What's unspecified:** On an off-map turn, does the Reader's `proximityToClose` value still get written to the active Loop's `proximity` and `lastTouchedAt`? Step 3 says "Write `proximityToClose` to the active Loop's `proximity`" but doesn't carve out an exception for off-map turns. No test is written for this because it's ambiguous.
**What's needed:** Confirm whether off-map turns update the active loop's proximity or skip that write.

---

## G-12 — `/api/session/end` response shape

**Section:** §4
**Specification says:** `POST /api/session/end` "triggers Profiler + metrics rollup"
**What's unspecified:** The response body shape. The spec lists it as a route but doesn't say what HTTP status or body it returns. Tests call it and check only that it returns 2xx; they do not assert on the body.
**What's needed:** Document the response (e.g., `{ ok: true }` or the session metrics).

---

## G-13 — `$1.60` near-ceiling Director signal: exact field name

**Section:** §13
**Specification says:** "At $1.60 the Director's payload flags it and the prompt biases toward closing"
**What's unspecified:** What field in the Director input carries this signal? The Director input is described as "running `costUsd`" in §5 step 4, which implies the Director already receives the raw `costUsd` and could compute the nearCeiling flag itself. But "the payload flags it" suggests a boolean field. No test is written for the $1.60 behavior specifically (only the $2.00 ceiling behavior is tested).
**What's needed:** Confirm whether it's a boolean field (e.g., `nearCeiling: true`) or just the raw `costUsd` value, and what "the prompt biases toward closing" means (is this enforced in the Director system prompt or in code?).

---

## G-14 — `loopsChained` at session level vs. map level

**Section:** §12, §5 step 8
**Specification says:** "loopsChained = closed loops referenced by some later loop's `chainedFromLoopId` (§6.4 — the only definition)"
**What's unspecified:** `Session.loopsChained` is a per-session metric. But loops exist on a map across sessions. Does `loopsChained` count chains that originated in THIS session specifically (i.e., the loop that was chained-FROM was closed in this session), or any chain relationship on the map? The test assumes per-session (only chains where the originating close happened in the current session are counted).
**What's needed:** Confirm the session scoping of `loopsChained`.

---

## G-15 — `/api/_test/enqueue` behavior when server is not in `LLM_MODE=mock`

**Section:** README (test hook spec)
**What's unspecified:** If someone accidentally runs tests against a production server (without `LLM_MODE=mock`), should `/api/_test/enqueue` return 404 (not mounted) or 403? The choice affects whether tests fail fast with a clear error or hang waiting for real LLM responses. The README recommends returning 404 to make the misconfiguration obvious immediately.
**What's needed:** Confirm 404 (not mounted) vs. 403 (mounted but refused).

---

## G-16 — Generator retry: which errors trigger the one retry, which skip immediately?

**Section:** §5 step 7, §7 (structured outputs)
**Specification says:** "A Generator exception (API error, schema-invalid output after one retry) logs a `generation_failed` Event and is skipped"
**What's unspecified:** "One retry" is mentioned only in the context of Generator jobs. Does the same retry policy apply to Reader/Director/Profiler/Safety structured output failures? §7 says "on schema-validation failure retry once, then skip and log" for Haiku structured outputs generally — but the "skip" behavior differs for Reader/Director (they are in the critical path) vs. Generator (async, silently dropped). Tests only cover the Generator case (where failure is observable via `generation_failed` event).
**What's needed:** Clarify skip-vs-error for Reader/Director schema failures (these would presumably bubble up as pipeline errors, not silent skips).

---

**RESOLVED 2026-06-11:** all 16 gaps are answered authoritatively in `docs/TDD.md` §17 ("Contract clarifications"). Tests should be read against those answers; this file remains as the historical record of what the spec left unsaid.

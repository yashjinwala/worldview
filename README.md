# Worldview

**Bring the thing you can't stop wondering about — leave actually getting it.**

A conversation with one AI guide, a living map of your thinking, and an invisible
**Director** choosing — every turn, transparently — how to serve your curiosity.

> The prose in the `[PLACEHOLDER]` sections below is the author's to write — these are
> scaffolds, not copy. Everything outside them is factual and current.

---

## Why clicks, not session length

[PLACEHOLDER — the metric stance, in the author's voice. The north star is **clicks**:
loops closed in a way that opens the next loop (PRD §4). Session length is a *health
signal*, not the objective — a confused user produces a long session, a delighted one a
short one. Say why, plainly, the way the PRD decision log says it.]

## The pre-registered kill test

[PLACEHOLDER — the honest bet, written *before* the build (PRD §10). ~10 unprompted
sessions with real people on questions they genuinely hold; no notifications. Desktop-only
protocol. ≥4 of 10 unprompted returns within a week = the multi-session bet lives, ≤2
falsifies it, 3 extends the cohort. State the n≈10 caveat (friends return out of goodwill)
out loud so it can't be graded on a curve later.]

## What this is

[PLACEHOLDER — PRD §1–2 in the author's voice. One screen, two panes: a conversation with
a single guide on the left, a living map that grows as you talk on the right. Why not just
ask ChatGPT — the table in PRD §2. What it is *not*: not a course, not a chatbot, not
Wikipedia.]

---

## Run it

Clone-and-run holds — a single Node process (not serverless), zero-config SQLite, only one
secret needed:

```bash
npm install
npx prisma db push          # creates the SQLite db from prisma/schema.prisma
npm run dev                 # http://localhost:3000
```

The only thing you must provide is an Anthropic API key, in `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

`DATABASE_URL` already defaults to `file:./dev.db` (committed in `.env`), so nothing else is
required. Optional env flags: `TUTOR_MODEL` (e.g. `claude-opus-4-8` for the Opus Tutor),
`SESSION_COST_LIMIT` (default `2.0`), `GLOBAL_DAILY_LIMIT_USD` (default `20`),
`FORCE_ARTIFACT` (a template id or `true`, for deterministic artifact testing).

### Run the contract suite

73 spec-derived tests, written before the implementation and never modified by it, run
against a real server in mock mode (no API key needed):

```bash
npx vitest run --config tests/vitest.config.ts
```

```
Test Files  10 passed (10)
     Tests  73 passed (73)
```

### Debug surfaces

- `/dev/artifacts` — all six v1 interactive templates rendered from sample props
- `/stats` — the v1 eval instrument: per-session metrics, the persisted user model, the
  Director decision log, organic-chain rate, Reader-dispute candidates

---

## Demo

[PLACEHOLDER — a ~90-second screen recording of one session (captured manually post-build),
and the Conductor-pane screenshot. Drop them here, one scroll below the pitch, per §16 item 10.]

<!--
![Session recording](docs/assets/session.gif)
![Conductor pane](docs/assets/conductor.png)
-->

## Reader-agreement eval

[PLACEHOLDER — reserved for the post-build hand-label pass (PRD §10): ~50 real exchanges
labeled against the Reader's appetite/`justClosed` reads (the Conductor 👍/👎 collects the
candidates), with agreement reported here. The north star must not stay self-graded homework.]

---

## How it's built

The server-side engine (the **Curiosity Engine**) and the Worldview client are one Next.js
Node process.

| Layer | Where |
|---|---|
| Per-turn pipeline (Reader → Director → Tutor, async Generator + Safety) | `src/lib/pipeline.ts` |
| The single LLM-call module + mock seam (TDD §18) | `src/lib/llm.ts`, `src/lib/mockStore.ts` |
| Prompts (the product — §7 verbatim) | `src/lib/prompts.ts` |
| Data model (Prisma / SQLite) | `prisma/schema.prisma` |
| API routes (`/api/onboard`, `/api/turn` SSE, …) | `src/app/api/**` |
| Six v1 artifact templates + Zod schemas | `src/templates/**` |
| UI — onboarding, shelf, two-pane session, React Flow map, Conductor | `src/components/**` |

The spec is the source of truth and lives alongside the code:

- `docs/PRD.md` — the product: vision, metrics, the worked example
- `docs/TDD.md` — the build contract: pipeline, prompts, schema, acceptance checklist (§16)
- `design/mockup.html` — the canonical design (open it in a browser)
- `design/tokens.css` — the design tokens (all 20 §10 templates)
- `tests/` — the spec-derived contract suite
- `BUILD_NOTES.md` — decisions made where the spec was silent

The orchestration is transparent by design: every Director decision is logged and shown in
the **Conductor pane**, and each row carries a 👍/👎 — *did the guide read you right?* — that
doubles as the Reader eval instrument.

License: MIT (see `LICENSE`).

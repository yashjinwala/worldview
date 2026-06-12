# Worldview v2 — Test Suite Architecture

**Status:** Red-first contract suite. Every test here is fully written against the spec. All tests fail until
the implementation satisfies them. The implementing agent is forbidden from modifying any file under `tests/`.

---

## Directory layout

```
tests/
  README.md                  ← you are here
  GAPS.md                    ← spec silences found during test-writing
  manual-walkthrough.md      ← human test script (3 sessions)
  vitest.config.ts           ← vitest config; global setup/teardown
  contract/
    setup.ts                 ← global setup: starts server, runs prisma db push
    helpers.ts               ← shared utilities: HTTP wrappers, SSE parser, Prisma client, mock helpers
    onboarding.test.ts       ← §4 + §5.1: POST /api/onboard
    loop-lifecycle.test.ts   ← §6.4: node/loop transitions
    pipeline.test.ts         ← §5: per-turn pipeline mechanics
    synthesis.test.ts        ← §5 steps 3+5: view ledger, synthesis beat
    return-flow.test.ts      ← §5 step 8 + return turn 1: Profiler, <resume>
    sse.test.ts              ← §4: SSE event contract
    cost.test.ts             ← §13: cost model and ceiling
    director.test.ts         ← §5 step 4 + §8: Director validation and logging
    position.test.ts         ← §5 step 3 + §8: positionShift, proximity, lastTouchedAt
  templates/
    schemas.test.ts          ← §10: zod schema validation for the six v1 templates
```

---

## How to run

```bash
# From the project root
npx vitest run --config tests/vitest.config.ts

# Watch mode
npx vitest --config tests/vitest.config.ts

# Single file
npx vitest run --config tests/vitest.config.ts tests/contract/onboarding.test.ts

# Verbose server output (shows Next.js startup logs)
VERBOSE_SERVER=1 npx vitest run --config tests/vitest.config.ts
```

**Prerequisites:**
- `npm install` (Prisma client generated)
- `ANTHROPIC_API_KEY` need not be set — the test server runs in `LLM_MODE=mock` and never calls the real API
- The test server binds to port `3001`; if that port is in use, set `TEST_PORT=<port>` and `TEST_BASE_URL=http://localhost:<port>`

---

## Required test hooks — the implementer MUST provide these

This is the minimal seam the suite requires. Nothing else may be assumed about internals.

### Activation

When the environment variable `LLM_MODE=mock` is set, the server's single LLM-call module routes **every** outbound LLM call (for all seven roles: `sharpen`, `reader`, `director`, `tutor`, `generator-map`, `generator-artifact`, `profiler`, `safety`) to the mock queue instead of the Anthropic API. The real Anthropic SDK must not be invoked at all under `LLM_MODE=mock`.

---

### Control endpoints (mounted only when `LLM_MODE=mock`)

#### `POST /api/_test/enqueue`

Enqueues a scripted response for the next call to the given role. Responses are consumed **FIFO per role** — each role has its own independent queue. A response enqueued for `reader` does not affect the `director` queue, etc.

**Request body** (one of the following shapes, discriminated on `role`):

```typescript
type MockEnqueueBody =
  | {
      role: 'sharpen'
      sharpened: string           // the value returned as sharpenedQuestion from /api/onboard
      usage: UsageTokens
    }
  | {
      role: 'reader'
      parsed: ReaderOutput        // the full structured output the Reader call returns
      usage: UsageTokens
    }
  | {
      role: 'director'
      tools: DirectorToolCall[]   // array of tool_use blocks the Director call returns
      usage: UsageTokens
    }
  | {
      role: 'tutor'
      text: string                // full text; delivered as 3 equal SSE tutor_delta chunks
      usage: UsageTokens
    }
  | {
      role: 'generator-map'
      parsed: GeneratorMapOutput  // { nodes: Array<{title, summary, hookQuestion}> }
      usage: UsageTokens
    }
  | {
      role: 'generator-artifact'
      parsed: object              // the template props JSON returned by the Generator
      usage: UsageTokens
    }
  | {
      role: 'profiler'
      parsed: ProfilerOutput      // { data: UserModelData, resumeSummary: string }
      usage: UsageTokens
    }
  | {
      role: 'safety'
      parsed: SafetyOutput        // { flag: boolean, category: string|null, note: string|null }
      usage: UsageTokens
    }

type UsageTokens = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
}

type DirectorToolCall = { name: string; input: Record<string, unknown> }

type ReaderOutput = {
  appetite: 'leaning_in' | 'neutral' | 'restless'
  proximityToClose: number           // 0..1
  justClosed: boolean
  closedLoopId?: string | null
  conversationNodeId: string | null
  positionShift?: string | null
  synthesisAnswer?: string | null
  evidence: string
}
```

**Response:** `{ ok: true }` on success, `{ error: string }` with status 400 on bad input.

---

#### `POST /api/_test/reset`

Clears all mock queues for all roles. Does **not** touch the database.

**Response:** `{ ok: true }`

---

#### `POST /api/_test/db/reset`

Truncates all Prisma-managed tables in foreign-key-safe order (Events → Artifacts → DirectorDecision → Message → Loop → ViewSnapshot → MapNode → Session → Map → UserModel → User). Used between tests for a clean-slate DB.

**Response:** `{ ok: true }`

---

### Queue-empty semantics

| Role | Behavior when queue is empty |
|---|---|
| `sharpen` | Returns `rawQuestion` verbatim as `sharpenedQuestion` (no sharpening). |
| `reader` | **Throws** — logs a `mock_queue_empty` Event; the pipeline returns HTTP 500. A test that triggers a Reader call without enqueueing a response is a test bug. |
| `director` | **Throws** — same as above. |
| `tutor` | **Throws** — same as above. |
| `generator-map` | Returns an empty node list `{ nodes: [] }` and logs a warning. Generator jobs are async and non-critical; empty defaults keep pipeline tests clean. |
| `generator-artifact` | Returns `null` (Generator job silently dropped); logs `generation_failed`. |
| `profiler` | Returns a minimal model + `"No summary available."` as `resumeSummary`. Session end must never fail because the Profiler queue was empty. |
| `safety` | Returns `{ flag: false, category: null, note: null }`. Safety is async and non-critical. |

---

### Tutor stream simulation

When the mock dequeues a `tutor` response, it splits `text` into three approximately equal chunks and writes them to the SSE stream as successive `tutor_delta` events with ~5 ms delays between chunks (simulating streaming). The `usage` field is applied to `Session.costUsd` exactly as a real call would — so setting large `input_tokens`/`output_tokens` values in mock usage is the mechanism for cost-ceiling tests.

---

### Cost accounting under mock

`Session.costUsd` is incremented after every mock call using the `usage` field and the same pricing constants used in production (`SONNET_IN_PER_TOK`, `SONNET_OUT_PER_TOK`, `HAIKU_IN_PER_TOK`, `HAIKU_OUT_PER_TOK`). Tests that need to hit the cost ceiling use:

```typescript
const CEILING_USAGE: UsageTokens = { input_tokens: 200_000, output_tokens: 100_000 }
// Tutor cost alone: ~$0.60 in + ~$1.50 out = $2.10 → exceeds $2.00 ceiling after one turn
```

---

## DB reset strategy between tests

Each test file calls `resetDB()` in its `beforeEach`. This calls `POST /api/_test/db/reset`, which truncates all tables in FK order. The server process lives for the entire test run (started once in global setup); only the DB state is reset between tests.

A single SQLite file is created in the OS temp directory (`/tmp/worldview-test-<timestamp>.db`) by the global setup and used for all tests. The same path is exposed as `TEST_DB_PATH` so `helpers.ts` can instantiate a Prisma client pointing at the same file for direct assertions.

---

## Implementer rules

1. **Never modify any file under `tests/`.** Add new test files if you wish, but never edit existing ones.
2. The mock seam (the three control endpoints and `LLM_MODE=mock` routing) is a first-class build requirement, not a test convenience. It belongs in the implementation alongside the real LLM module.
3. Tests cite the spec section they cover as a comment (`// §5 step 3`). If a test fails, read the cited section; do not "fix" the test.
4. The suite is intentionally red until implementation satisfies it. That is the point.

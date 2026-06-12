# Worldview

Bring the thing you can't stop wondering about. Leave actually getting it — with a map of how your thinking got there.

---

It's late, and some question has its hooks in you. Why everyone suddenly cares about the national debt. Why planes are slower than they were in 1970. Whether the thing your uncle said at dinner is actually true. So you open a tab. Then a YouTube video, a Reddit thread, a Wikipedia page that assumes you already know the thing you opened it to learn. Forty minutes later you have nine tabs and roughly the understanding you started with, and the moment you close the laptop the whole thread evaporates.

A chatbot doesn't really fix this. It answers the question and stops. Staying curious is back on you, and tomorrow the conversation is gone. Worldview makes the opposite trade: it treats your question as the *start* of a thread, and every payoff it lands is built to open the next one.

![Onboarding](docs/assets/onboarding.png)

## How it works

One screen, two panes. On the left, a conversation with a single guide. On the right, a map of your thinking that grows as you talk — questions and ideas, not a syllabus. Open loops glow like embers; settled ones go quiet. Come back tomorrow and the map is exactly where you left it.

Behind the guide is a **Director** that makes one decision every turn: how to serve *you*, right now. Explain when you're building, challenge when you're coasting, go a layer deeper, change the angle, or hand you the payoff as something you can drag instead of read. It reads two things — how engaged you are, and how close you are to the "ohhh" — and picks its move.

Two rules it never breaks. It won't hand you the answer: a thread only settles when *you* say the insight back in your own words, because you can't really own a view you were handed. And it won't trade truth for a hook — if the honest answer kills a great setup, the setup dies.

![A session in progress](docs/assets/session.png)

Sometimes the click is better felt than read — a slider where you watch interest payments cross the defense budget as you drag the rate, a predict-then-reveal that catches your wrong intuition in the act. Those are real interactive components, filled per-moment for the exact question you're on.

![The interactive templates](docs/assets/artifacts.png)

## The one number I watch

Not minutes. Session length is a bad proxy for the feeling this sells — a confused person produces a long session, a delighted one might produce a short one. The number is the **click**: a loop closed in a way that opens the next loop. The quality multiplier is whether that next loop actually got pursued.

This also kills the obvious failure mode by construction. If you optimize for time-on-app, you build something that strings people along. If you optimize for resolved curiosity, you build something that resolves curiosity.

The Director's reasoning isn't hidden, either. Every move it makes is logged and shown in the **Conductor pane**, one row per turn, each with a quiet 👍/👎 — *did the guide read you right?* That's there for trust (nothing you can't see is steering you), and it doubles as the instrument I use to check whether the Director's reads are any good.

## The bet, written down before I built it

The honest version of "is this worth making" is one great session on a question you actually hold, often enough that you come back without being nagged. So that's the test, and I wrote the thresholds down first so I can't grade on a curve later:

Ten friends, real questions, no notifications and no reminders. **Four or more come back on their own within a week → the multi-session bet lives. Two or fewer → it's dead.** Three means the sample's too small to call and I extend it. Desktop only, because a friend opening a texted link on a phone would be measuring mobile polish, not the curiosity hypothesis. And it's friends, who return partly out of goodwill — which is written here so I remember it when I read the result.

One more piece of honesty baked into the scope: the name promises a *worldview*, and the view-forming layer in v1 is deliberately thin — a before/after on what you thought, a once-a-session "so what do you actually think now?", a "Where you stand" line that remembers. It costs nothing and it's never the pitch. If returners ignore it, it stays a side effect and earns no more investment. The pitch is the curiosity; the view is what curiosity slowly turns into.

## Run it

One Node process, zero-config SQLite, one secret.

```bash
npm install
npx prisma db push          # creates the local SQLite database
npm run dev                 # http://localhost:3000
```

The only thing you provide is an Anthropic API key, in `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Everything else has a default. A few optional knobs: `TUTOR_MODEL` (point the guide at Opus instead of Sonnet), `SESSION_COST_LIMIT` (default `$2`), `FORCE_ARTIFACT=slider-sim` (spawn an interactive on the next turn, for poking at it deterministically).

### Tests

The contract was written before the code, by a separate pass that never saw the implementation: 73 spec-derived tests that run against a real server with the model calls mocked, so no key is needed.

```bash
npx vitest run --config tests/vitest.config.ts
#  Tests  78 passed (78)      ← the 73 frozen tests + a few I added
```

Two debug surfaces worth a look: `/dev/artifacts` renders all six interactive templates from sample data, and `/stats` is the eval page — per-session numbers, the model it's built of you, the full decision log.

## Under the hood

Server and client are one Next.js process — not serverless, because the turn's response stream stays open while the map fills in behind it, and you never wait on that.

| Piece | Where |
|---|---|
| Per-turn pipeline (Reader → Director → guide, async map/artifact generation, post-hoc safety check) | `src/lib/pipeline.ts` |
| One module every model call routes through (the mock seam lives here too) | `src/lib/llm.ts` |
| The prompts — which are most of the actual product | `src/lib/prompts.ts` |
| Six interactive templates + their schemas | `src/templates/` |
| The map (React Flow), chat, Conductor, shelf | `src/components/` |
| Data model (Prisma / SQLite) | `prisma/schema.prisma` |

A couple of decisions that matter: the guide adapts per-turn, but the safety floor lives in its system prompt where no Director instruction can reach it. The Director's per-decision log is structured as a training set from day one — there's no learned policy in v1 (ten users would never train one, and pretending otherwise would be theater), but the day there's data to learn from, it's already collected.

The full spec, the design reference, and the reasoning behind every call live next to the code in [`docs/`](docs/), with the build-time decisions in [`BUILD_NOTES.md`](BUILD_NOTES.md).

## Where it's honest about v1

The weakest link is re-engagement: there are no notifications. v1's entire return loop is the shelf, the glow on an unfinished thread, and your own memory. I know that's thin, and it's the first thing the kill test pressures.

A ~90-second recording of a real session goes here once I've captured one:

<!-- ![Session recording](docs/assets/session.gif) -->

And the Reader-grading result — ~50 real exchanges hand-labeled against what the Director thought you were doing — goes here once that pass runs. Until then, the north star is honestly still self-graded, and I'd rather say so than pretend otherwise.

---

MIT. Build on it.

# Worldview v2 — Manual Walkthrough Script

This script covers what automated tests cannot judge: streaming feel, typography, animation quality, and the human experience of the curiosity loop. Run it against a real build with a real `ANTHROPIC_API_KEY`. Three sessions are scripted; each builds on the previous, so run them in order on the same browser profile.

**Setup:** `npm install && npx prisma db push && ANTHROPIC_API_KEY=<key> npm run dev`. Clear localStorage before Session 1.

---

## Session 1 — First contact

### Step 1.1 — Onboarding screen
**Action:** Open `http://localhost:3000`. Observe the landing screen.
**Expected:** Full-screen card. Four posture chips visible: "understand something confusing," "challenge a belief I hold," "go deep on an obsession," "surprise me." No map visible yet. No chat pane yet. Design: warm dark background (#0b0a08), ember-orange accent.
**Spec:** §9 — onboarding screen, posture chips

### Step 1.2 — Question textarea
**Action:** Click "understand something confusing." Observe.
**Expected:** A free-text question area appears below the chips. Placeholder encourages a genuine question. "Surprise me" hides the textarea; the others show it. The textarea is empty; no pre-filled text.
**Spec:** §9, PRD §5.1

### Step 1.3 — Sharpen-and-confirm: editable
**Action:** Type "I don't really get why everyone's freaking out about the national debt." Click the primary continue button (or press Enter).
**Expected:** A sharpen-and-confirm line appears: something like "So the question is: Is the US national debt actually dangerous — and how would we know? — right?" The question is in an **editable field**, not static text. The user can modify it before confirming. A "Yes, let's go" button (or equivalent) confirms.
**Spec:** §4 — "The client renders the sharpened question in an editable field"; §9 onboarding

### Step 1.4 — First turn streams
**Action:** Confirm the sharpened question.
**Expected:** The two-pane layout fades in. Chat pane (~55% left) begins streaming the Tutor's first reply immediately. Map pane (~45% right) seeds in the background — 4–6 frontier nodes fade in asynchronously, the root node already visible and current (accent ring). The user is never waiting for the map to see Tutor text start.
**Spec:** §5.6 — loading contract; §3 architecture; §9 layout

### Step 1.5 — Articulation contract told once
**Action:** Read the Tutor's first reply fully.
**Expected:** Somewhere in the first reply, the guide names the articulation contract in one light line. Examples: "fair warning — I won't just hand you answers; I'll know you've got something when you can say it back." This line appears **exactly once, ever** — in this first reply only. Note: if the line is missing, this is a P0 bug. If it appears verbatim later, that is also a P0 bug.
**Spec:** §7.1 Tutor anchor — "FIRST SESSION ONLY: somewhere in your first reply, name the contract in one light line"

### Step 1.6 — First hook opens a loop
**Action:** Read the first reply. Observe the map.
**Expected:** The root node glows with a slow ember pulse (~2.8 s period). No other node glows yet (seed nodes are dim/dashed frontier). The first reply ends with a dangling question or "want to find out?" — it does not feel complete.
**Spec:** PRD §5.2 — "every payoff lands and leaves a thread visibly hanging"; §9 map glow

### Step 1.7 — Conductor pane
**Action:** Click the "Conductor" toggle (header or bottom area).
**Expected:** The Conductor pane opens as a bottom drawer. One row visible: `Turn 1 · signals (no Reader on turn 1 — cold start) · tools: setTutorMode(explain) · rationale: [≤25 words, plain English]`. The header reads "How the guide is adapting to you this session." Nothing labeled "Director" or "pipeline" — the framing is "how the guide adapts."
**Spec:** §9 Conductor pane; §7.2 Director prompt (rationale ≤25 words)

### Step 1.8 — Artifact unlocks without blocking
**Action:** Continue the conversation for 4–6 turns on the same topic. Watch for an artifact tile appearing in chat.
**Expected:** When the Director calls `spawnArtifact`, a tile appears in the chat with a shimmer "building…" state — the conversation continues normally (next Tutor reply streams) while the artifact is building. The tile resolves to the interactive **without blocking the conversation**. Opening the artifact expands it inline or to a modal. The artifact has a title (Fraunces font) and a closing line.
**Spec:** §5.4, §5.6 — "user never waits for generation"; §9 chat artifacts

### Step 1.9 — Artifact closing line raises next hook
**Action:** Interact with the artifact to its completion state.
**Expected:** The closing line (rendered in Fraunces font) does two things: lands a payoff in one sentence AND raises the next question in one more sentence. After reading it, you should feel the tug of a new question. Note whether the map shows a new node lighting up shortly after the artifact completes.
**Spec:** §10 — "closingLine: one sentence: lands the payoff then raises the next question"

---

## Session 5 — Return and memory

*(Run after completing sessions 2–4 on the same map. The guide should have enough signal in the user model.)*

### Step 5.1 — Shelf landing screen
**Action:** Return to the app after a break (at least a few minutes, so idle-close can trigger). Observe the landing screen.
**Expected:** You land on the **shelf** — one card per map. The card shows: held question, count of glowing loops, the **brightest open loop named outright** (not "X open loops" but "Still open: What actually sets the interest rate?" or similar), "Where you stand" one-liner if set, and last-visited date. The shelf is a hook, not a menu. A "bring a new question" button is visible.
**Spec:** §9 home (map shelf); PRD §5.8

### Step 5.2 — "Your guide has noticed" line
**Action:** Examine the map card carefully. Look for a third line below the standard card content.
**Expected:** After 3+ sessions, the card gains one additional line: "Your guide has noticed: [one styleNote from the user model]." Example: "Your guide has noticed: you think best in concrete numbers." This line should feel like a small surprise — it makes the user model visible to the person it's modeling. If the session count is below 3, this line must be absent.
**Spec:** §9 — "After the user's 3rd session, a card gains one more line: 'Your guide has noticed: [one styleNote from the user model]'"

### Step 5.3 — Welcome-back beat names a real loop
**Action:** Click the map card to resume. Read the first Tutor message of this session.
**Expected:** The guide opens by re-hooking a specific named open loop from the previous session — not a generic "welcome back," but something like "Last time we landed on how Japan holds so much debt without crisis — but the real puzzle is what sets the interest rate, and that's still open." The loop named should be visible as glowing on the map. This requires `Map.resumeSummary` to have been written at the end of the prior session.
**Spec:** §5 return-turn-1 — "welcome back — re-hook the brightest open loop, by name"; §9; PRD §5.8

### Step 5.4 — Synthesis references prior view
**Action:** Have a conversation until the synthesis beat fires (should happen once ≥3 loops close on a challenge-a-belief map).
**Expected:** The synthesis question references the user's existing "Where you stand" entry if one exists: e.g., "Last time you said 'the debt number itself isn't the danger — it's the rate.' Given everything you've explored since — what do you actually think now?" Not a generic "what do you think?" The synthesis fires once per session, is not graded, and is not asked again in the same session even if more loops close.
**Spec:** §7.2 Director prompt — synthesis beat; §5 step 5; PRD §5.7

### Step 5.5 — Shelf card hook after synthesis
**Action:** Let the synthesis answer be captured. End the session. Return to the shelf.
**Expected:** The map card's "Where you stand" one-liner updates to the latest synthesis answer. The card continues to name the brightest open loop (the hook), not just the view. Both can coexist on the card.
**Spec:** §9 shelf — '"Where you stand" one-liner when set'; PRD §5.7

---

## Session 15 simulation — Long-map and export

*(These steps can be simulated by seeding the DB with 15+ session records and enough nodes/loops. Alternatively, run them naturally after extensive use.)*

### Step 15.1 — Overview toggle
**Action:** Open a map with 30+ nodes. Find the overview control.
**Expected:** A single button/toggle in the map pane header or toolbar fits the **entire map** in view (React Flow `fitView`). In this overview, nodes render as slim title-only bars — readable as a shape, not a wall of text. The layout remains a tree (dagre, root at left). Toggling back restores the previous viewport.
**Spec:** §9 map — "Overview toggle: one control fits the entire map in view"

### Step 15.2 — Stale-glow dimming
**Action:** Identify a loop whose `lastTouchedAt` is older than 14 days. (In development, override the clock or seed a stale record directly in the DB — `UPDATE loops SET last_touched_at = datetime('now', '-15 days') WHERE id = '<id>'`.)
**Expected:** That node's ember glow pulses at **50% opacity** (dimmed) compared to recently-touched glowing nodes. The dimming is visual only — the loop is still open, still touchable, and still shows in the shelf card. It should feel like an ember fading, not an error state. A fresh conversation on that topic should restore the full glow (updating `lastTouchedAt`).
**Spec:** §9 map — "Stale-glow decay: loops with `lastTouchedAt` older than 14 days pulse at 50% opacity"; PRD §5.3 — "old question dims from invitation toward memory instead of nagging"
**Dev note:** The 14-day clock makes this hard to test without a seed override. Add a `STALE_LOOP_DAYS` env override (default 14) for deterministic manual testing and acceptance criteria G-01 equivalent.

### Step 15.3 — Soft-close
**Action:** Right-click (or long-press) a stale glowing node on the map. Look for a context menu.
**Expected:** A node context menu appears. One option: "I've settled this elsewhere." Selecting it: (a) closes the loop (`closedBy: "user"`), (b) the node stops glowing and shows as settled (solid, muted, small ✓), (c) no chaining behavior — no loop automatically opens on another node as a result, (d) the action is not undoable from the UI.
**Spec:** §9 map — "node context menu also offers soft-close on stale open loops"; §6.4 — "user closes a stale loop... sets closedAt, closedBy: 'user'"

### Step 15.4 — View history trail
**Action:** On a challenge-a-belief map with multiple synthesis answers captured (View Snapshots in DB), click the history icon next to "Where you stand" in the header.
**Expected:** A list of dated snapshots opens — each entry shows the date and the synthesis answer text. Example:
```
June 5 — "The debt number itself isn't the danger — it's the rate"
June 11 — "The real risk is the rate crossing the growth rate, not the headline number"
```
The list is in reverse-chronological order. No actions other than reading are available — this is a read-only trail.
**Spec:** §9 layout — "a small history icon that opens the dated list of all ViewSnapshots — the trail"; PRD §5.7 — "a small history icon that opens the dated trail"

### Step 15.5 — Editable "Where you stand"
**Action:** Click the ✎ edit affordance next to "Where you stand" in the header.
**Expected:** The current view becomes an editable text field. Typing a new value and confirming writes a new `ViewSnapshot` row (with the current timestamp) and updates `Map.currentView`. The header immediately shows the new text and as-of date. The new snapshot appears at the top of the history trail. The edit does not trigger a Tutor response — it is purely a user-driven annotation.
**Spec:** §9 layout — "a ✎ edit affordance (typing a replacement writes a new ViewSnapshot)"; PRD §5.7 — "the edit is itself a snapshot"

### Step 15.6 — Export / Import round-trip
**Action:** On the shelf page, click the "Export" button in the footer.
**Expected:** A JSON file downloads. It contains all user data: maps, nodes, loops, sessions, messages, view snapshots, user model. Open the JSON and verify it is valid JSON and contains at least the map IDs you've used.

**Action:** Clear localStorage (browser devtools → Application → Local Storage → delete all). Reload the app. You should see the first-time onboarding flow (no shelf). Click "Import" in the footer.
**Expected:** Select the downloaded JSON file. The shelf reappears with all your maps. Opening a map shows the same node state, loop state, and "Where you stand" as before the clear. The import is a complete round-trip.
**Spec:** §9 — "Export button; your maps are yours to carry"; PRD §5.8 — "export/import covers it at v1 scale"; §16 (acceptance item 15)

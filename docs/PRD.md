# Worldview v2 — Product Requirements Document (PRD)

**Version:** 0.7
**Date:** 2026-06-11
**Status:** Locked for v1 build (all open questions resolved — see Decision log)
**Companion doc:** `TDD.md` (technical contracts, prompts, data model, build checklist)

### Decision log (most recent first)
- **Premise validation (2026-06-12).** An independent adversarial agent validated the founding painpoints *cold* (before seeing any product material), then judged the product against its own frozen verdict. Accepted in full: **the thesis is one great session on the question you hold tonight** (curriculum mismatch — the only painkiller among our five pains); "unformed views" and "no durable record" are weak, projection-prone pains, so the view layer built on them (before→after · synthesis · "Where you stand") is **demoted from promise to free side effect** — kept because it costs nothing, never led with, killed if returners ignore it. The agent's kill test is pre-registered in §10 with thresholds, ahead of the build. Three real gaps it surfaced are recorded as directions (§10): the **calibration gap** and **so-what gap** are woven into the Tutor anchor now (TDD §7.1); **trust → async primary-source grounding** is the committed v1.5 candidate.
- **Final adversarial gate (2026-06-11, review #2): 8 technical + 3 product P0s found and fixed in the docs** (technical batch in the TDD log). Product fixes, in what-the-user-feels terms: the **articulation contract is now told to the user** (the guide names it once, lightly, in its first reply — no more "why won't it just confirm I got it"); the **view trail got its UI** (dated history + edit affordance + as-of date behind "Where you stand" — the product's most distinctive promise now has a surface); **long-map hygiene** (overview zoom; loops untouched 14 days dim; soft-close "I've settled this elsewhere"); the **shelf hooks** (cards name your brightest open question; "your guide has noticed…" makes the user model visible after 3 sessions); surprise-me consults your interests from session 3; **export/import** guards the everything-lives-in-this-browser risk. **Deliberately deferred, not missed:** push/notification re-engagement (service-worker scope; v1's return loop is shelf + glow + memory — acknowledged as the weakest link in the retention chain) and cross-device sync (export/import covers it at v1 scale).
- **Completeness batch (2026-06-11):** the return experience is now designed (map shelf · welcome-back beat that re-hooks your brightest glowing loop · the guide remembers where you left off via a resume summary); the **view ledger** cashes the rebrand promise (synthesis answers become "Where you stand" on the map header, with dated snapshots — a featherweight version of v1's deliverable); packaging locked (open source under MIT; README leads with evidence). **Identity stance made explicit:** v1 leads with curiosity *by design* — curiosity is the honest acquisition channel for thinking; the view-forming layer deepens version by version toward the name.
- **Rebrand (2026-06-11): the product is Worldview; this spec is Worldview v2. The Curiosity Engine is its foundation.** "Curiosity Engine" now names the underlying system (Director · Reader · Tutor · Generator · loop mechanics · map); **Worldview** is the product. Forming a worldview — a genuine view that is yours — is the flagship use case the engine serves; understanding something confusing, going deep, and surprise-me are siblings that generate the raw material a view is made of. The prior Worldview repo (`~/Documents/worldview-v1`) is the v1 judgment prototype; its Examiner/certification mechanics are deliberately **not** in this build — they remain the v2+ bridge ("ready to actually earn this view?") to be added when usage shows users reaching for it.
- **Four genes adopted from Worldview v1 (2026-06-11):** tensions as hook fuel (Generator/Tutor prefer live disagreements over facts) · before→after position record (`startingPosition` at onboarding + `positionShift` on loop close) · articulation-gated clicks (a loop settles only when the user says the insight in their own words) · a light synthesis beat (once per session after 3+ closes on a held-belief map: "what do you actually think now?"). **Not adopted, deliberately:** the Examiner as a firewalled agent, the depth ladder, the deliverable document — each breaks the curiosity contract (playful, ungraded, instant value).
- **North star reframed: resolved curiosity, not session length.** The metric is **loops closed that open the next loop** ("clicks"). Session length is a health signal, not the objective. Rationale: session length is a bad proxy for the feeling we sell ("I finally get it") — a confused user produces a long session, a delighted one may produce a short one. This also removes the prior "ethical line on session-length-gaming" risk by construction.
- **The orchestration is transparent, not hidden.** The invisible agent (now named the **Director**) makes a per-turn decision that the user can inspect in the **Conductor pane**. "Aware-but-suppressed" is dropped: the Tutor embodies its instructions without narrating them, but nothing is concealed.
- **Agent renamed:** "Personalization" → **Director**. It doesn't personalize content; it directs the experience for this user.
- **Artifact premise reversed.** We assumed an open-source "interactive artifact framework" exists; it doesn't. v1 = **twenty parameterized templates we build once**, filled with JSON by the Generator. No generated code runs → no sandbox needed. Generated-code artifacts are a v2 line item.
- **All eight open questions from v0.5 are decided** (design system: shadcn/ui + Tailwind · map: React Flow · tool catalog: locked at 4 tools · tool selection: LLM-reasoning with logged decisions, no bandit until there's data · session: 30-min idle boundary, active-time length · artifacts: templates as above · harness: raw Anthropic TS SDK · models: Sonnet 4.6 Tutor / Haiku 4.5 aux, $2/session ceiling). Details in TDD.
- **v1 scope cut** (§9): no bandit, no Redis/queue infra, no mid-stream safety interruptor, no accounts, desktop-first.
- *(Prior, retained)* Curiosity-loop experience model; user never waits for the Generator; safety floor lives in the trusted Tutor anchor; map is a visualization of the conversation, not the engine.

---

## 1. What this is

**Worldview: bring a question that's been nagging you — leave actually understanding it, with a map of how your thinking got there. Keep coming back, and it becomes a map of what you think.**

One screen, two panes. On the left, a conversation with a single guide. On the right, a living map that grows as you talk. Behind the guide, an invisible **Director** decides — every turn — how to serve *this* user *right now*: explain or challenge, go deeper or change angle, spawn an interactive, grow the map. Its decisions are visible on demand in the **Conductor pane**.

Under the hood is the **Curiosity Engine** — the product-agnostic foundation (Director, one-voice Tutor, Generator, loop mechanics, map). The engine serves curiosity in any posture; **forming a worldview — a genuine view that is yours — is the flagship use case**, and the other postures feed it: every click of understanding is raw material a view is eventually made of.

**v1 leads with curiosity by design.** You can't market your way into someone's beliefs — but a question they can't put down walks them there. The view-forming layer in v1 is deliberately thin (a starting position, per-loop shifts, the synthesis beat, "Where you stand") and deepens version by version toward the name; the v1 judgment prototype's Examiner mechanics are the designed endpoint of that arc.

**Positioning line:** *"Bring the thing you can't stop wondering about — leave actually getting it."*

## 2. Why not just ask ChatGPT?

This is the question every user (and every reader of this repo) asks first. A chatbot answers your question and stops. The burden of staying curious is on you; the thread evaporates when you close the tab. Curiosity Engine makes the opposite contract:

| A chatbot | Curiosity Engine |
|---|---|
| Answers, then waits | Treats your question as the *start* of a thread; every payoff deliberately opens the next hook |
| One register for everyone | A Director adapts the guide per-turn to how *you* are responding — challenge when you're coasting, land the payoff when you're close |
| Text in, text out | Delivers the "click" as an interactive when that lands better than prose |
| Conversation evaporates | Your understanding persists as a map that's waiting, unchanged and growing, when you return |

It is not a course (no curriculum), not a chatbot (it has an agenda *for you*), not Wikipedia (it cares about your path, not the material's structure).

## 3. Who it's for

**Primary persona — the off-hours wonderer.** Mid-20s to 40s, intellectually restless, default behavior today is a 40-minute Wikipedia/YouTube/Reddit spiral that ends in tabs, not understanding. Arrives with a genuinely held question roughly half the time ("why does everyone suddenly care about the national debt?"); the other half arrives with an itch but no question — served by the *surprise me* posture (the designed cold-start path, not an afterthought).

Depth appetite varies per person and per night; the Director's appetite signal handles that — we do not maintain separate archetypes.

**v1 audience reality:** the builder + friends (~10 people). Every metric and mechanism in this doc is sized to be honest at that scale (see §6 and the no-bandit decision).

## 4. North star & metrics

**North star: clicks — loops closed in a way that opens the next loop.**

The experience model is the curiosity loop: open a hook ("the market kept calling the debt crisis wrong for 40 years — want to see why?") → pull in → **click** (the "ohhh" that resolves it) → the click itself raises the next question. The north star counts completed loops; the chain (did the close open a follow-up the user pursued?) is the quality multiplier.

- **Primary:** loops closed per session; **chain rate** (% of closes that spawn a pursued next loop).
- **Guardrails:** dangling-loop ratio (opened but never resolved — the "clickbait detector"); return rate.
- **Health signals (watch, don't optimize):** session active time, response latency, artifact completion rate.
- At v1 scale these are read qualitatively per-session via the Conductor pane and the decision log, not as dashboards.

## 5. The experience

### 5.1 Onboarding — surface a held question
Full-screen, one prompt: **"What brought you here today?"** with four posture chips: *understand something confusing · challenge a belief I hold · go deep on an obsession · surprise me*. Free-text question below. The system sharpens what you typed into a crisp held question ("I don't get the debt panic" → "Is the US national debt actually dangerous, and how would we know?"), confirms it with you in one line, and the map seeds itself as the first reply streams. *Surprise me* skips extraction: the guide opens with a provocative hook in a domain inferred from nothing (v1: a curated rotation). *Challenge a belief* additionally captures a one-line starting position — "and what do you think right now?" — stored verbatim as the *before* of the before→after record (§5.7).

### 5.2 The Tutor — the one voice
The only thing the user ever talks to. Warm, direct, allergic to lecture mode. It always works in loops: never a complete-feeling answer that closes the conversation; every payoff lands *and* leaves a thread visibly hanging. It challenges when challenge is the right tool and explains when that is — per the Director's call — but it never sacrifices truth for a hook (the duty-of-care floor, written in full in TDD §7.1, is binding and cannot be overridden by any Director instruction). When it challenges, it does so dialectically: it surfaces the *real tension* — the strongest honest split among thoughtful people — gives you enough to take a side, and asks where you land. And it never hands over the click: a loop only settles when *you* say the insight in your own words — the socratic move exists to let you produce it, because you cannot own a view you were handed. It tells you this exactly once, in its first reply ever: *"fair warning — I won't just hand you answers; I'll know you've got something when you can say it back."* The product's deepest rule, stated as a wink instead of discovered as friction.

### 5.3 The map — a picture of your thinking
Right pane, React Flow. Nodes are questions/ideas, not syllabus topics. Current node ringed; open loops glow; settled loops sit solid and calm; frontier nodes (generated, not yet visited) are dim and dashed. The map only ever grows — return tomorrow and it's exactly where you left it. It's a *view* of the conversation and your thinking, not a thing you study. New nodes materialize asynchronously with a soft fade — **the user never waits for generation.** And the map ages gracefully: an overview zoom shows a big map's whole shape at once; loops untouched for two weeks dim from invitation toward memory; and any stale question can be soft-closed without ceremony — *"I've settled this elsewhere"* — because a glow should feel like an ember, never an unread badge.

### 5.4 Artifacts — the click, made tangible
Sometimes the payoff is better felt than read: a slider showing interest payments eat the budget as rates rise; a predict-then-reveal that catches your wrong intuition in the act. Artifacts come from a fixed library of twenty specified templates (TDD §10; six built in v1, fourteen in phase 2) filled per-moment by the Generator. They appear as unlockable tiles in the chat and badges on the map node. Two jobs: **deliver a click** or **open a loop**. Never block the conversation.

### 5.5 The Conductor pane — the orchestration, visible
A collapsible drawer. Per turn, one row: the signals the Director read (*"restless, far from a click"*), the move it made (*branch + spawn artifact*), and its one-line rationale. Three audiences: the user (trust — nothing hidden is steering you), the builder (this is the v1 eval instrument), and the repo reader (this is the demo screenshot).

### 5.6 Loading contract
Tutor text streams immediately, always. Map growth and artifacts arrive when ready. Nothing the Generator does ever delays a reply.

### 5.7 The view taking shape — before→after + the synthesis beat
On a held-belief map, the system keeps a featherweight record of motion: your one-line starting position from onboarding, and — whenever a loop on it closes with your view visibly moved — a one-line landing (*"thought the debt number was the danger → now thinks the rate is"*). Nodes carry their shift, so the map stops being just *where you went* and becomes *what changed*. And once per session, after a few loops have closed, the guide pulls you up for exactly one question: *"given everything — what do you actually think now?"* Not graded, not certified, never repeated in the same session; just the question that turns a pile of clicks into the beginning of a view. **And your answer persists:** the latest becomes *"Where you stand"* on the map's header — with its date, an edit affordance (your view changed in the shower? type the new one; the edit is itself a snapshot), and a small history icon that opens the dated trail. Months of returning shows not just what you think, but how you got here — and unlike a chat log, you can actually *see* it. (The full Worldview-v1 machinery — an Examiner that certifies the view is genuinely earned — is the designed v2+ extension for users who reach this beat and want more.)

### 5.8 Coming back
Returning users land on the **shelf** — one card per map, and each card is a hook, not a menu item: it names your brightest still-open question outright (*"Still open: what actually sets the interest rate?"*), shows how many loops glow, and where you stand. After a few sessions a card gains one more line — *"your guide has noticed: you think best in concrete numbers"* — the user model, finally visible to the person it's modeling. Open a card and the guide doesn't greet you like a stranger: it remembers where you left off and re-hooks that brightest thread. The dangling loop is the product's own return ticket. (Honest limitation, logged as such: v1 has no notifications — the return loop is the shelf, the glow, and your own memory. And because everything lives in your browser, the shelf has an Export button; your maps are yours to carry.)

## 6. The three agents (product lens)

- **Director (the product).** Invisible-but-inspectable. Each turn it reads appetite (leaning in vs. restless) × proximity to a click, consults what it knows about this user, and picks 1–2 moves from a four-tool catalog: set the Tutor's mode, grow the map (deepen/branch), spawn an artifact, raise caution. It optimizes for clicks and chains. v1 decision-making is LLM reasoning over an explicit policy (the 2×2 in TDD §6) — every decision and its outcome is logged so a learned policy can replace it *when there is data to learn from*. Across sessions it maintains a **user model** (what modes land, pacing, interests, what produced clicks) — this persistent model is the moat the repo demonstrates.
- **Tutor (the one voice).** Sonnet-class. Embodies the Director's per-turn instruction without narrating it. Emits a per-turn loop-state read (is a payoff close? did one just land?) that feeds the next decision.
- **Generator (the world-builder).** Haiku-class, async. Grows map nodes and fills artifact templates. It receives the specific loop question it's serving — its output must resolve *this user's* open loop, so it is not blind to that (a deliberate v0.6 change; it remains blind to the broader profile and history).

## 7. The worked example (the spec in miniature)

*User arrives, picks "understand something confusing," types: "I don't really get why everyone's freaking out about the national debt."*

**Onboarding** sharpens it: *"Is the US national debt actually dangerous — and how would we know?"* User confirms. Map seeds in the background: *Who is the debt owed to? · Why Japan's is worse and nothing happened · What economists actually fear · The 40 years of wrong predictions.*

**Turn 1** — Director (cold start): `setTutorMode(explain)`. Tutor opens a loop instead of lecturing: *"Here's the strange part: serious people have predicted a US debt crisis since 1981, and they've been wrong for forty years straight. Either they're all fools, or they're early. Want to figure out which?"* Loop opens; node glows.

**Turn 3** — User's replies are getting longer, faster (Reader: *leaning in, far from click*). Director: `expandMap(currentNode, deepen)`. Tutor goes one level down into who actually holds the debt; two subnodes materialize on the map mid-reply.

**Turn 5** — User says "ok but that just sounds like it's fine forever, which can't be right." Reader: *leaning in, near click*. Director: `setTutorMode(challenge)` + `spawnArtifact(slider-sim, currentNode, "when do interest payments actually become the problem?")`. Tutor pushes back on "fine forever," and an interactive unlocks: a slider where the user drags the average interest rate and watches interest payments cross defense spending. The user drags it, sits with it — **click**. Loop settles on the map; the artifact's closing line opens the next one: *"so the danger isn't the debt — it's the rate. What sets the rate?"*

**Turn 8** — Replies shorten; latency up (Reader: *restless, far*). Director: `expandMap(rootNode, branch)`. Tutor releases the thread gracefully and offers the map's most provocative frontier node instead. Conductor pane row: *"restless + far → branch; offering 'why Japan is fine at 260%.'"*

Session ends at 31 minutes of the user's own accord: 3 loops closed, 2 chained, 1 dangling. The Profiler updates the user model: *challenge mode landed; slider artifact produced the strongest click; prefers concrete numbers over theory.* Tomorrow the map is exactly there, one node still glowing.

## 8. v1 scope

**In v1:** onboarding (4 postures) · Tutor chat with streaming · Director with 4 tools + decision logging · map (React Flow, materialize animation, persistent, append-only) · 6 artifact templates (14 more fully specified, built in phase 2) · Conductor pane · before→after position record + synthesis beat + view ledger ("Where you stand" + dated snapshots, held-belief maps) · map shelf + welcome-back return flow · view history + editable "Where you stand" · map overview zoom + stale-loop dimming + soft-close · data export/import · user model persisted across sessions (visible on the shelf after 3 sessions) · post-turn safety/accuracy check · MIT open source · cost guard ($2/session) · anonymous local identity (no accounts) · desktop-first responsive (mobile: usable chat/map tab switch, not polished).

**Not v1 (deliberate):** bandit/learned policy (logged for, not built) · push/web notifications for re-engagement (service-worker scope; v1's return loop is shelf + glow — the acknowledged weakest link) · cross-device sync (export/import instead) · Redis/queues/workers (in-process async) · mid-stream safety interruptor (post-hoc check instead) · accounts & auth · COPPA/minors handling (adults-only disclaimer) · content-moderation infra · experimentation infra · native mobile · generated-code artifacts · video.

## 9. Non-goals
Test-prep/retention learning app · static curriculum · single-agent chatbot · deterministic Wikipedia-derived graph · full free-form graph explorer · building a design system from scratch.

## 10. Risks, validation & the pre-registered kill test

**The kill test (committed 2026-06-12, before the build):** run ~10 unprompted sessions with real people on questions they genuinely hold; no notifications, no reminders. Measure: (a) **unprompted return within one week — below 40% falsifies the multi-session bet**; (b) whether returners read or update "Where you stand" — ignored means the view layer stays a side effect and earns no further investment; (c) at one month, do users say *"I formed a view on X"* or *"I learned about X"* — the latter means the name is ahead of the product and the v2+ Examiner bridge stays shelved.

**Validated open directions (from the premise validation; not v1):**
- **Calibration gap** — explanations pitched to *demonstrated* knowledge. Partially woven in now (Tutor anchor + user model); per-topic knowledge tracking is a v2 candidate.
- **Trust deficit → primary sources.** Committed v1.5; design settled 2026-06-12 (reframed by Yash from post-hoc to **orchestrated grounding** — post-hoc citation is trust theater; the answer must be *informed* by the source). Three placements: **(1) Generator grounds always** — artifact-fill jobs get web search (they're already async = zero latency cost, and artifacts carry the load-bearing numbers — the most fabrication-exposed surface); sources render in the template's existing `caption` field. **(2) Tutor grounds when directed** — the Director's `note` calls for it (load-bearing/post-cutoff/contested-empirical claims, or the Reader detecting expressed doubt — "wait, is that true?"); implemented via Anthropic's server-side web-search tool inside the same Tutor call, with a visible "checking sources…" beat — the pause *is* the credibility signal. Catalog stays locked at 4 tools. **(3) The post-hoc check demotes to auditor** — a contradiction with a grounded claim feeds the existing safety-note card, unifying trust + accuracy. Cost: searches counted toward the $2 ceiling, capped per session.
- **So-what gap** — understanding that should move a decision. The anchor now keeps a hidden decision in view; a decision-shaped posture is a v2 candidate.

**Risks to validate by using it (not build blockers):**
1. **Can the Reader actually detect "about to get it" vs. "lost"?** The whole Director loop leans on this read. Conductor pane makes every read inspectable next to what the user actually did.
2. **Does challenge retain or repel?** Logged per decision; judge from transcripts.
3. **Do template artifacts feel like payoffs or like widgets?** Six templates is a bet; the click should feel made-for-this-moment.
4. **Can onboarding extract a genuinely held question** (vs. a polite topic)? The sharpen-and-confirm step is the mitigation; watch how often users edit it.
5. **Cross-topic behavior** (user jumps from debt to football): v1 creates a second map per topic; revisit if it feels fragmenting.

## 11. Open questions
None. All v0.5 questions are decided (see Decision log); remaining unknowns are usage-validated risks (§10), not build blockers.

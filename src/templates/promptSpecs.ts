// Per-template prop specs handed to the Generator (artifact-fill, §7.5). These spell
// out the exact field shape and the cross-field invariants the Zod schemas enforce, so
// the model fills valid props on the first attempt. Server-side only.

export const TEMPLATE_PROMPT_SPECS: Record<string, string> = {
  'slider-sim': `Produce JSON with these exact fields:
{
  "title": string,            // artifact headline
  "caption": string,          // source/year basis; OMIT only if you cannot name a year/basis
  "closingLine": string,      // one sentence landing the payoff, then one raising the next question
  "variable": { "label": string, "min": number, "max": number, "step": number, "unit": string, "initial": number },
  "outcomes": [ { "atOrBelow": number, "headline": string, "detail": string } ],
  "referenceLines": [ { "value": number, "label": string } ]   // optional
}
HARD CONSTRAINTS: 2–5 outcomes, sorted strictly ascending by atOrBelow; the LAST outcome's atOrBelow MUST EQUAL variable.max; variable.initial must be between min and max.`,

  'predict-reveal': `Produce JSON:
{
  "title": string, "caption": string, "closingLine": string,
  "question": string,
  "options": string[],          // EXACTLY 3 or 4 choices
  "correctIndex": number,        // 0-based index into options, in range
  "reveal": string,              // 1–3 sentences explaining the correct answer
  "whyYourGuessWasReasonable": string   // 1–2 sentences validating the wrong intuition
}
Use a clearly-correct empirical question (not a contested one).`,

  'before-after': `Produce JSON:
{
  "title": string, "caption": string, "closingLine": string,
  "before": { "label": string, "body": string },   // body 2–4 sentences, non-empty
  "after":  { "label": string, "body": string }     // body 2–4 sentences, non-empty
}
Both before and after are REQUIRED with non-empty bodies.`,

  'evidence-cards': `Produce JSON:
{
  "title": string, "caption": string, "closingLine": string,
  "claim": string,
  "cards": [ { "headline": string, "body": string, "supports": boolean } ],  // 3–6 cards, MIXED supports, NOT pre-sorted
  "verdict": string
}`,

  timeline: `Produce JSON:
{
  "title": string, "caption": string, "closingLine": string,
  "events": [ { "year": number, "yearLabel": string?, "label": string, "detail": string } ],  // 4–10 events
  "pattern": string   // the punchline connecting them
}
year is a number (negative = BCE). yearLabel is optional display override.`,

  tradeoff: `Produce JSON:
{
  "title": string, "caption": string, "closingLine": string,
  "scenario": string,
  "optionA": { "label": string, "consequences": string[] },   // 2–4 consequences
  "optionB": { "label": string, "consequences": string[] },   // 2–4 consequences
  "insight": string
}`,
}

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

  'draw-your-guess': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "xLabel": string, "yLabel": string, "xUnit": string?, "yUnit": string?,
  "knownPoints": [ { "x": number, "y": number } ],   // ≥3, sorted ascending by x — the revealed left portion
  "hiddenPoints": [ { "x": number, "y": number } ],  // ≥3, sorted ascending; EVERY x MUST BE > the max x in knownPoints
  "reveal": string }`,

  'scale-ladder': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "subject": { "label": string, "value": number, "unit": string },
  "rungs": [ { "label": string, "value": number, "emoji": string? } ] }   // 3–6 rungs, sorted SMALLEST-to-largest by value`,

  'base-rate-box': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "scenario": string, "populationLabel": string,
  "cells": { "truePositive": {"count":int,"label":string}, "falsePositive": {"count":int,"label":string},
             "trueNegative": {"count":int,"label":string}, "falseNegative": {"count":int,"label":string} },
  "question": string, "intuitiveMisread": string, "insight": string }
The four counts MUST sum to a single integer ≤ 10,000.`,

  'feedback-loop-stepper': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "loopType": "reinforcing" | "balancing",
  "startingCondition": string,
  "steps": [ { "id": string, "label": string, "description": string, "effect": "increases"|"decreases"|"enables" } ],  // 4–7; last loops back to the first
  "punchline": string }`,

  'distribution-vs-anecdote': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "xLabel": string, "xUnit": string?,
  "dataPoints": [ { "value": number, "count": number } ],   // 8–20 buckets spanning the distribution
  "anecdote": { "value": number, "label": string, "detail": string },   // usually an extreme tail
  "insight": string }`,

  'rank-the-list': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "question": string,
  "items": [ { "id": string, "label": string, "detail": string? } ],   // 4–7, NOT pre-sorted in correct order
  "correctRanking": [ string ],   // item ids, index 0 = rank 1; MUST be a permutation of the item ids
  "insight": string }`,

  'odds-calibrator': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "claim": string,           // a falsifiable statement, clearly either true or false
  "isTrue": boolean, "reveal": string, "calibrationNote": string }`,

  'compounding-clock': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "unit": string, "initialValue": number, "timeLabel": string, "timeSteps": int,   // 10–50 periods
  "scenarios": [ { "rate": number, "label": string, "color": string? } ],   // 2–4; rate is a per-period decimal, e.g. 0.07
  "referenceValue": { "value": number, "label": string }? }`,

  'survivorship-filter': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "startLabel": string, "startTotal": number,
  "stages": [ { "label": string, "surviving": number, "dropped": number, "dropReason": string } ],
  "visibleGroup": string, "insight": string }
3–5 stages. For EACH stage, surviving + dropped MUST equal the input to that stage (startTotal for stage 0, the previous stage's surviving thereafter).`,

  'steelman-duel': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "question": string,
  "sideA": { "label": string, "points": [string] },   // 3–4 strongest honest arguments
  "sideB": { "label": string, "points": [string] },   // 3–4
  "synthesis": string, "consensusLeans": "A"|"B"|"neither"? }`,

  'anatomy-labeler': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "diagramLabel": string, "viewWidth": number, "viewHeight": number,
  "regions": [ { "id": string, "shape": "rect", "x":number, "y":number, "w":number, "h":number, "fillColor": "#hex", "label": string, "description": string }
             | { "id": string, "shape": "circle", "cx":number, "cy":number, "r":number, "fillColor": "#hex", "label": string, "description": string } ],  // 4–8; all coords fit within viewWidth×viewHeight
  "connections": [ { "fromId": string, "toId": string, "label": string? } ]? }`,

  'counterfactual-fork': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "forkPoint": { "year": string, "description": string },
  "actualPath": { "label": string, "events": [ { "year": string, "outcome": string } ] },          // 3–5 events
  "counterfactualPath": { "label": string, "events": [ { "year": string, "outcome": string } ] },   // 3–5
  "insight": string }`,

  'budget-allocator': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "question": string, "totalLabel": string,
  "categories": [ { "id": string, "label": string, "actualPercent": number, "hint": string? } ],   // 4–8; actualPercent values MUST sum to exactly 100
  "insight": string }`,

  'threshold-hunt': `Produce JSON:
{ "title": string, "caption": string, "closingLine": string,
  "question": string, "unit": string, "minValue": number, "maxValue": number,
  "thresholdValue": number,   // strictly between minValue and maxValue
  "belowLabel": string, "aboveLabel": string, "revealTolerance": number, "reveal": string }`,
}

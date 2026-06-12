/**
 * Zod schema tests for the six v1 artifact templates — §10
 * Imports from the specced path: src/templates/schemas.ts
 * Each test is either a valid parse (must succeed) or a targeted invalid case (must fail).
 * Cross-field invariants (z.refine constraints) are explicitly tested.
 */

import { describe, it, expect } from 'vitest'
import {
  SliderSimSchema,
  PredictRevealSchema,
  BeforeAfterSchema,
  EvidenceCardsSchema,
  TimelineSchema,
  TradeoffSchema,
} from 'src/templates/schemas'

// ---------------------------------------------------------------------------
// slider-sim — §10
// ---------------------------------------------------------------------------

describe('SliderSimSchema — §10', () => {
  // Valid sample — all constraints satisfied
  it('accepts a valid slider-sim prop set', () => {
    const result = SliderSimSchema.safeParse({
      title: 'When do interest payments become the problem?',
      closingLine: 'The danger is not the number — it is the rate.',
      variable: {
        label: 'Average interest rate',
        min: 1,
        max: 15,
        step: 0.5,
        unit: '%',
        initial: 4,
      },
      outcomes: [
        { atOrBelow: 5, headline: 'Sustainable territory', detail: 'Interest costs below 3% of GDP.' },
        { atOrBelow: 10, headline: 'Warning zone', detail: 'Interest costs rival discretionary spending.' },
        { atOrBelow: 15, headline: 'Crisis threshold', detail: 'Interest costs exceed defense budget.' },
      ],
    })
    expect(result.success).toBe(true)
  })

  // §10 slider-sim: "must be sorted ascending" — outcomes not in ascending atOrBelow order
  it('rejects slider-sim when outcomes are not sorted ascending by atOrBelow', () => {
    const result = SliderSimSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      variable: { label: 'Rate', min: 0, max: 10, step: 1, unit: '%', initial: 5 },
      outcomes: [
        { atOrBelow: 10, headline: 'High', detail: 'High detail' },
        { atOrBelow: 5, headline: 'Low', detail: 'Low detail' }, // out of order
      ],
    })
    expect(result.success).toBe(false)
  })

  // §10 slider-sim: "last entry's atOrBelow must equal max"
  it('rejects slider-sim when last outcome atOrBelow does not equal variable.max', () => {
    const result = SliderSimSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      variable: { label: 'Rate', min: 0, max: 10, step: 1, unit: '%', initial: 5 },
      outcomes: [
        { atOrBelow: 5, headline: 'Low', detail: 'Low detail' },
        { atOrBelow: 8, headline: 'High', detail: 'High detail' }, // last atOrBelow=8 ≠ max=10
      ],
    })
    expect(result.success).toBe(false)
  })

  // §10 slider-sim: "initial: number — starting thumb position; must be between min and max"
  it('rejects slider-sim when initial is outside [min, max]', () => {
    const result = SliderSimSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      variable: { label: 'Rate', min: 1, max: 15, step: 1, unit: '%', initial: 20 }, // 20 > max=15
      outcomes: [{ atOrBelow: 15, headline: 'Ok', detail: 'Ok' }],
    })
    expect(result.success).toBe(false)
  })

  // §10 slider-sim: "2–5 entries" — reject fewer than 2
  it('rejects slider-sim with fewer than 2 outcome entries', () => {
    const result = SliderSimSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      variable: { label: 'Rate', min: 0, max: 10, step: 1, unit: '%', initial: 5 },
      outcomes: [
        { atOrBelow: 10, headline: 'Only', detail: 'Only one' },
      ],
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// predict-reveal — §10
// ---------------------------------------------------------------------------

describe('PredictRevealSchema — §10', () => {
  // Valid sample
  it('accepts a valid predict-reveal prop set', () => {
    const result = PredictRevealSchema.safeParse({
      title: 'What does the minimum wage research actually say?',
      closingLine: 'The real answer depends on how much, and where.',
      question: 'What happens to employment when the minimum wage rises modestly?',
      options: [
        'Employment always falls significantly',
        'Employment falls slightly in some contexts',
        'Employment is mostly unaffected',
        'Employment always rises',
      ],
      correctIndex: 1,
      reveal: 'At typical magnitudes, the evidence shows at most a modest and context-dependent effect.',
      whyYourGuessWasReasonable: 'Basic supply-demand intuition predicts a price floor should reduce demand for labor.',
    })
    expect(result.success).toBe(true)
  })

  // §10 predict-reveal: "correctIndex: number — 0-based index into options" — out of range
  it('rejects predict-reveal when correctIndex is out of range', () => {
    const result = PredictRevealSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      question: 'Pick one',
      options: ['A', 'B', 'C'],
      correctIndex: 5, // index 5 out of range for 3 options
      reveal: 'The answer is B.',
      whyYourGuessWasReasonable: 'It seemed reasonable.',
    })
    expect(result.success).toBe(false)
  })

  // §10 predict-reveal: "exactly 3 or 4 answer choices"
  it('rejects predict-reveal with only 2 options', () => {
    const result = PredictRevealSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      question: 'Binary?',
      options: ['Yes', 'No'],
      correctIndex: 0,
      reveal: 'Yes.',
      whyYourGuessWasReasonable: 'It seemed right.',
    })
    expect(result.success).toBe(false)
  })

  // §10 predict-reveal: negative correctIndex
  it('rejects predict-reveal with negative correctIndex', () => {
    const result = PredictRevealSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      question: 'Pick one',
      options: ['A', 'B', 'C'],
      correctIndex: -1,
      reveal: 'A.',
      whyYourGuessWasReasonable: 'A seemed right.',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// before-after — §10
// ---------------------------------------------------------------------------

describe('BeforeAfterSchema — §10', () => {
  // Valid sample
  it('accepts a valid before-after prop set', () => {
    const result = BeforeAfterSchema.safeParse({
      title: 'Vaccine side-effect risk — two framings',
      closingLine: 'You are 200× more likely to get that side effect from the disease itself.',
      before: {
        label: 'The intuitive framing',
        body: 'The vaccine has a 1 in 1 million chance of causing myocarditis. That sounds scary.',
      },
      after: {
        label: 'The accurate framing',
        body: 'The disease causes myocarditis at 1 in 5,000 — 200 times more often. The vaccine is the safer option.',
      },
    })
    expect(result.success).toBe(true)
  })

  // Missing 'after' field — required
  it('rejects before-after with missing after section', () => {
    const result = BeforeAfterSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      before: { label: 'Before', body: 'Body.' },
      // after is missing
    })
    expect(result.success).toBe(false)
  })

  // Missing body in before
  it('rejects before-after when before.body is empty string', () => {
    const result = BeforeAfterSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      before: { label: 'Before', body: '' },
      after: { label: 'After', body: 'Some content.' },
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// evidence-cards — §10
// ---------------------------------------------------------------------------

describe('EvidenceCardsSchema — §10', () => {
  // Valid sample — 4 cards (within 3–6)
  it('accepts a valid evidence-cards prop set with 4 cards', () => {
    const result = EvidenceCardsSchema.safeParse({
      title: 'Does social media cause teen depression?',
      closingLine: 'The evidence is messier than either side admits.',
      claim: 'Social media causes teen depression',
      cards: [
        { headline: 'Correlation study (2018)', body: 'Heavy users 2× more likely to report depression symptoms.', supports: true },
        { headline: 'Reverse-causation finding', body: 'Depressed teens use social media more — cause and effect may be reversed.', supports: false },
        { headline: 'Longitudinal evidence (2021)', body: 'Reduced use in randomized trial did not reduce depression scores.', supports: false },
        { headline: 'Platform-specific finding', body: 'Instagram specifically associated with body-image issues in girls.', supports: true },
      ],
      verdict: 'The evidence is mixed; correlation is real but causation is not established.',
    })
    expect(result.success).toBe(true)
  })

  // §10 evidence-cards: "3–6 cards" — fewer than 3
  it('rejects evidence-cards with fewer than 3 cards', () => {
    const result = EvidenceCardsSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      claim: 'Something is true',
      cards: [
        { headline: 'Card 1', body: 'Detail 1.', supports: true },
        { headline: 'Card 2', body: 'Detail 2.', supports: false },
      ],
      verdict: 'It is complicated.',
    })
    expect(result.success).toBe(false)
  })

  // §10 evidence-cards: "3–6 cards" — more than 6
  it('rejects evidence-cards with more than 6 cards', () => {
    const cards = Array.from({ length: 7 }, (_, i) => ({
      headline: `Card ${i + 1}`,
      body: `Detail ${i + 1}.`,
      supports: i % 2 === 0,
    }))
    const result = EvidenceCardsSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      claim: 'Something',
      cards,
      verdict: 'Complicated.',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// timeline — §10
// ---------------------------------------------------------------------------

describe('TimelineSchema — §10', () => {
  // Valid sample — 5 events (within 4–10)
  it('accepts a valid timeline prop set with 5 events', () => {
    const result = TimelineSchema.safeParse({
      title: 'US debt ceiling: same movie, different cast',
      closingLine: 'Resolved every time, at the last moment — so far.',
      events: [
        { year: 1917, label: 'Debt ceiling created', detail: 'Congress sets a cap to streamline WWI borrowing.' },
        { year: 1939, label: 'First major increase', detail: 'New Deal spending pushes Congress to raise the ceiling.' },
        { year: 1979, label: 'Technical default scare', detail: 'A backlog in check processing causes a brief technical default.' },
        { year: 2011, label: 'S&P downgrade', detail: 'US credit rating cut for the first time after a near-miss.' },
        { year: 2023, label: 'X-date standoff', detail: 'Deal reached hours before projected default date.' },
      ],
      pattern: 'Resolved every time, always at the last moment — so far.',
    })
    expect(result.success).toBe(true)
  })

  // §10 timeline: "4–10 events" — fewer than 4
  it('rejects timeline with fewer than 4 events', () => {
    const result = TimelineSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      events: [
        { year: 1900, label: 'Event A', detail: 'Detail A.' },
        { year: 1950, label: 'Event B', detail: 'Detail B.' },
        { year: 2000, label: 'Event C', detail: 'Detail C.' },
      ],
      pattern: 'The pattern.',
    })
    expect(result.success).toBe(false)
  })

  // §10 timeline: "4–10 events" — more than 10
  it('rejects timeline with more than 10 events', () => {
    const events = Array.from({ length: 11 }, (_, i) => ({
      year: 1900 + i * 10,
      label: `Event ${i + 1}`,
      detail: `Detail ${i + 1}.`,
    }))
    const result = TimelineSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      events,
      pattern: 'Pattern.',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// tradeoff — §10
// ---------------------------------------------------------------------------

describe('TradeoffSchema — §10', () => {
  // Valid sample
  it('accepts a valid tradeoff prop set', () => {
    const result = TradeoffSchema.safeParse({
      title: 'Central bank rate decision: raise or hold?',
      closingLine: 'There is no free lunch — only which costs you are willing to bear.',
      scenario: 'Inflation is running at 6%. The central bank must decide whether to raise rates or hold.',
      optionA: {
        label: 'Raise rates',
        consequences: [
          'Inflation falls over 12–18 months',
          'Unemployment rises 1–2 percentage points',
          'Currency strengthens',
          'Corporate debt stress increases',
        ],
      },
      optionB: {
        label: 'Hold rates',
        consequences: [
          'Inflation persists, eroding purchasing power',
          'Asset prices continue rising',
          'Currency weakens relative to peers',
        ],
      },
      insight: 'Both options impose real costs on real people; the choice is about which group bears them.',
    })
    expect(result.success).toBe(true)
  })

  // §10 tradeoff: "2–4 consequences" per option — fewer than 2 for optionA
  it('rejects tradeoff when optionA has fewer than 2 consequences', () => {
    const result = TradeoffSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      scenario: 'A choice must be made.',
      optionA: {
        label: 'Option A',
        consequences: ['Only one consequence'],
      },
      optionB: {
        label: 'Option B',
        consequences: ['Consequence 1', 'Consequence 2'],
      },
      insight: 'There are tradeoffs.',
    })
    expect(result.success).toBe(false)
  })

  // §10 tradeoff: "2–4 consequences" — more than 4 for optionB
  it('rejects tradeoff when optionB has more than 4 consequences', () => {
    const result = TradeoffSchema.safeParse({
      title: 'Test',
      closingLine: 'Test.',
      scenario: 'A decision must be made.',
      optionA: {
        label: 'Option A',
        consequences: ['Con 1', 'Con 2'],
      },
      optionB: {
        label: 'Option B',
        consequences: ['Con 1', 'Con 2', 'Con 3', 'Con 4', 'Con 5'], // 5 > max 4
      },
      insight: 'Insight here.',
    })
    expect(result.success).toBe(false)
  })
})

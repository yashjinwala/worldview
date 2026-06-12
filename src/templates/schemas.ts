// Zod schemas for the six v1 artifact templates (TDD §10). Cross-field invariants
// (sums, ordering, range, shape-dependent fields) are real refinements, not comments.
// These are the contract validated at artifact_ready receipt on the client and the
// shape the Generator's structured output is checked against on the server.

import { z } from 'zod'

// ── common fields present at the top level of every template's props ─────────
const commonFields = {
  title: z.string().min(1),
  caption: z.string().optional(),
  closingLine: z.string().min(1),
  opensHook: z.string().optional(),
}

// ── slider-sim ───────────────────────────────────────────────────────────────
export const SliderSimSchema = z
  .object({
    ...commonFields,
    variable: z.object({
      label: z.string().min(1),
      min: z.number(),
      max: z.number(),
      step: z.number(),
      unit: z.string(),
      initial: z.number(),
    }),
    outcomes: z
      .array(
        z.object({
          atOrBelow: z.number(),
          headline: z.string().min(1),
          detail: z.string().min(1),
        })
      )
      .min(2)
      .max(5),
    referenceLines: z
      .array(z.object({ value: z.number(), label: z.string().min(1) }))
      .optional(),
  })
  .superRefine((data, ctx) => {
    const { variable, outcomes } = data
    // initial must be within [min, max]
    if (variable.initial < variable.min || variable.initial > variable.max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'variable.initial must be between min and max', path: ['variable', 'initial'] })
    }
    // outcomes must be sorted strictly ascending by atOrBelow
    for (let i = 1; i < outcomes.length; i++) {
      if (outcomes[i].atOrBelow <= outcomes[i - 1].atOrBelow) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'outcomes must be sorted ascending by atOrBelow', path: ['outcomes', i, 'atOrBelow'] })
      }
    }
    // last entry's atOrBelow must equal variable.max
    const last = outcomes[outcomes.length - 1]
    if (last && last.atOrBelow !== variable.max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "last outcome's atOrBelow must equal variable.max", path: ['outcomes', outcomes.length - 1, 'atOrBelow'] })
    }
  })

// ── predict-reveal ─────────────────────────────────────────────────────────
export const PredictRevealSchema = z
  .object({
    ...commonFields,
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(3).max(4),
    correctIndex: z.number().int(),
    reveal: z.string().min(1),
    whyYourGuessWasReasonable: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.correctIndex < 0 || data.correctIndex >= data.options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'correctIndex out of range for options', path: ['correctIndex'] })
    }
  })

// ── before-after ──────────────────────────────────────────────────────────
export const BeforeAfterSchema = z.object({
  ...commonFields,
  before: z.object({ label: z.string().min(1), body: z.string().min(1) }),
  after: z.object({ label: z.string().min(1), body: z.string().min(1) }),
})

// ── evidence-cards ──────────────────────────────────────────────────────────
export const EvidenceCardsSchema = z.object({
  ...commonFields,
  claim: z.string().min(1),
  cards: z
    .array(
      z.object({
        headline: z.string().min(1),
        body: z.string().min(1),
        supports: z.boolean(),
      })
    )
    .min(3)
    .max(6),
  verdict: z.string().min(1),
})

// ── timeline ─────────────────────────────────────────────────────────────────
export const TimelineSchema = z.object({
  ...commonFields,
  events: z
    .array(
      z.object({
        year: z.number(),
        yearLabel: z.string().optional(),
        label: z.string().min(1),
        detail: z.string().min(1),
      })
    )
    .min(4)
    .max(10),
  pattern: z.string().min(1),
})

// ── tradeoff ─────────────────────────────────────────────────────────────────
const tradeoffOption = z.object({
  label: z.string().min(1),
  consequences: z.array(z.string().min(1)).min(2).max(4),
})

export const TradeoffSchema = z.object({
  ...commonFields,
  scenario: z.string().min(1),
  optionA: tradeoffOption,
  optionB: tradeoffOption,
  insight: z.string().min(1),
})

// ═══ Phase-2 templates (the remaining fourteen of the §10 catalog) ════════════

// ── draw-your-guess ──────────────────────────────────────────────────────────
export const DrawYourGuessSchema = z
  .object({
    ...commonFields,
    xLabel: z.string().min(1),
    yLabel: z.string().min(1),
    xUnit: z.string().optional(),
    yUnit: z.string().optional(),
    knownPoints: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
    hiddenPoints: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
    reveal: z.string().min(1),
  })
  .superRefine((d, ctx) => {
    const maxKnownX = Math.max(...d.knownPoints.map((p) => p.x))
    if (!d.hiddenPoints.every((p) => p.x > maxKnownX)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'all hiddenPoints.x must be > max(knownPoints.x)', path: ['hiddenPoints'] })
    }
  })

// ── scale-ladder ─────────────────────────────────────────────────────────────
export const ScaleLadderSchema = z
  .object({
    ...commonFields,
    subject: z.object({ label: z.string().min(1), value: z.number(), unit: z.string().min(1) }),
    rungs: z
      .array(z.object({ label: z.string().min(1), value: z.number(), emoji: z.string().optional() }))
      .min(3)
      .max(6),
  })
  .superRefine((d, ctx) => {
    for (let i = 1; i < d.rungs.length; i++) {
      if (d.rungs[i].value < d.rungs[i - 1].value) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'rungs must be sorted smallest-to-largest by value', path: ['rungs', i, 'value'] })
      }
    }
  })

// ── base-rate-box ────────────────────────────────────────────────────────────
const cell = z.object({ count: z.number().int().nonnegative(), label: z.string().min(1) })
export const BaseRateBoxSchema = z
  .object({
    ...commonFields,
    scenario: z.string().min(1),
    populationLabel: z.string().min(1),
    cells: z.object({ truePositive: cell, falsePositive: cell, trueNegative: cell, falseNegative: cell }),
    question: z.string().min(1),
    intuitiveMisread: z.string().min(1),
    insight: z.string().min(1),
  })
  .superRefine((d, ctx) => {
    const sum = d.cells.truePositive.count + d.cells.falsePositive.count + d.cells.trueNegative.count + d.cells.falseNegative.count
    if (sum > 10000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'the four cell counts must sum to ≤ 10,000', path: ['cells'] })
    }
  })

// ── feedback-loop-stepper ────────────────────────────────────────────────────
export const FeedbackLoopStepperSchema = z.object({
  ...commonFields,
  loopType: z.enum(['reinforcing', 'balancing']),
  startingCondition: z.string().min(1),
  steps: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        description: z.string().min(1),
        effect: z.enum(['increases', 'decreases', 'enables']),
      })
    )
    .min(4)
    .max(7),
  punchline: z.string().min(1),
})

// ── distribution-vs-anecdote ─────────────────────────────────────────────────
export const DistributionVsAnecdoteSchema = z.object({
  ...commonFields,
  xLabel: z.string().min(1),
  xUnit: z.string().optional(),
  dataPoints: z.array(z.object({ value: z.number(), count: z.number().nonnegative() })).min(8).max(20),
  anecdote: z.object({ value: z.number(), label: z.string().min(1), detail: z.string().min(1) }),
  insight: z.string().min(1),
})

// ── rank-the-list ────────────────────────────────────────────────────────────
export const RankTheListSchema = z
  .object({
    ...commonFields,
    question: z.string().min(1),
    items: z
      .array(z.object({ id: z.string().min(1), label: z.string().min(1), detail: z.string().optional() }))
      .min(4)
      .max(7),
    correctRanking: z.array(z.string().min(1)),
    insight: z.string().min(1),
  })
  .superRefine((d, ctx) => {
    const ids = new Set(d.items.map((i) => i.id))
    if (d.correctRanking.length !== d.items.length || !d.correctRanking.every((id) => ids.has(id)) || new Set(d.correctRanking).size !== d.correctRanking.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'correctRanking must be a permutation of item ids', path: ['correctRanking'] })
    }
  })

// ── odds-calibrator ──────────────────────────────────────────────────────────
export const OddsCalibratorSchema = z.object({
  ...commonFields,
  claim: z.string().min(1),
  isTrue: z.boolean(),
  reveal: z.string().min(1),
  calibrationNote: z.string().min(1),
})

// ── compounding-clock ────────────────────────────────────────────────────────
export const CompoundingClockSchema = z.object({
  ...commonFields,
  unit: z.string().min(1),
  initialValue: z.number(),
  timeLabel: z.string().min(1),
  timeSteps: z.number().int().positive(),
  scenarios: z
    .array(z.object({ rate: z.number(), label: z.string().min(1), color: z.string().optional() }))
    .min(2)
    .max(4),
  referenceValue: z.object({ value: z.number(), label: z.string().min(1) }).optional(),
})

// ── survivorship-filter ──────────────────────────────────────────────────────
export const SurvivorshipFilterSchema = z
  .object({
    ...commonFields,
    startLabel: z.string().min(1),
    startTotal: z.number().nonnegative(),
    stages: z
      .array(
        z.object({
          label: z.string().min(1),
          surviving: z.number().nonnegative(),
          dropped: z.number().nonnegative(),
          dropReason: z.string().min(1),
        })
      )
      .min(3)
      .max(5),
    visibleGroup: z.string().min(1),
    insight: z.string().min(1),
  })
  .superRefine((d, ctx) => {
    let input = d.startTotal
    for (let i = 0; i < d.stages.length; i++) {
      if (d.stages[i].surviving + d.stages[i].dropped !== input) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'stage surviving + dropped must equal the input to this stage', path: ['stages', i] })
      }
      input = d.stages[i].surviving
    }
  })

// ── steelman-duel ────────────────────────────────────────────────────────────
const duelSide = z.object({ label: z.string().min(1), points: z.array(z.string().min(1)).min(3).max(4) })
export const SteelmanDuelSchema = z.object({
  ...commonFields,
  question: z.string().min(1),
  sideA: duelSide,
  sideB: duelSide,
  synthesis: z.string().min(1),
  consensusLeans: z.enum(['A', 'B', 'neither']).optional(),
})

// ── anatomy-labeler ──────────────────────────────────────────────────────────
const rectRegion = z.object({
  id: z.string().min(1),
  shape: z.literal('rect'),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  fillColor: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
})
const circleRegion = z.object({
  id: z.string().min(1),
  shape: z.literal('circle'),
  cx: z.number(),
  cy: z.number(),
  r: z.number(),
  fillColor: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
})
export const AnatomyLabelerSchema = z.object({
  ...commonFields,
  diagramLabel: z.string().min(1),
  viewWidth: z.number().positive(),
  viewHeight: z.number().positive(),
  regions: z.array(z.discriminatedUnion('shape', [rectRegion, circleRegion])).min(4).max(8),
  connections: z.array(z.object({ fromId: z.string().min(1), toId: z.string().min(1), label: z.string().optional() })).optional(),
})

// ── counterfactual-fork ──────────────────────────────────────────────────────
const forkPath = z.object({
  label: z.string().min(1),
  events: z.array(z.object({ year: z.string().min(1), outcome: z.string().min(1) })).min(3).max(5),
})
export const CounterfactualForkSchema = z.object({
  ...commonFields,
  forkPoint: z.object({ year: z.string().min(1), description: z.string().min(1) }),
  actualPath: forkPath,
  counterfactualPath: forkPath,
  insight: z.string().min(1),
})

// ── budget-allocator ─────────────────────────────────────────────────────────
export const BudgetAllocatorSchema = z
  .object({
    ...commonFields,
    question: z.string().min(1),
    totalLabel: z.string().min(1),
    categories: z
      .array(z.object({ id: z.string().min(1), label: z.string().min(1), actualPercent: z.number(), hint: z.string().optional() }))
      .min(4)
      .max(8),
    insight: z.string().min(1),
  })
  .superRefine((d, ctx) => {
    const sum = d.categories.reduce((a, c) => a + c.actualPercent, 0)
    if (Math.abs(sum - 100) > 0.01) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'category actualPercent values must sum to 100', path: ['categories'] })
    }
  })

// ── threshold-hunt ───────────────────────────────────────────────────────────
export const ThresholdHuntSchema = z
  .object({
    ...commonFields,
    question: z.string().min(1),
    unit: z.string().min(1),
    minValue: z.number(),
    maxValue: z.number(),
    thresholdValue: z.number(),
    belowLabel: z.string().min(1),
    aboveLabel: z.string().min(1),
    revealTolerance: z.number(),
    reveal: z.string().min(1),
  })
  .superRefine((d, ctx) => {
    if (!(d.thresholdValue > d.minValue && d.thresholdValue < d.maxValue)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'thresholdValue must be strictly between minValue and maxValue', path: ['thresholdValue'] })
    }
  })

// ── registry: templateId → schema (all twenty) ───────────────────────────────
export const TEMPLATE_SCHEMAS = {
  'slider-sim': SliderSimSchema,
  'predict-reveal': PredictRevealSchema,
  'before-after': BeforeAfterSchema,
  'evidence-cards': EvidenceCardsSchema,
  timeline: TimelineSchema,
  tradeoff: TradeoffSchema,
  'draw-your-guess': DrawYourGuessSchema,
  'scale-ladder': ScaleLadderSchema,
  'base-rate-box': BaseRateBoxSchema,
  'feedback-loop-stepper': FeedbackLoopStepperSchema,
  'distribution-vs-anecdote': DistributionVsAnecdoteSchema,
  'rank-the-list': RankTheListSchema,
  'odds-calibrator': OddsCalibratorSchema,
  'compounding-clock': CompoundingClockSchema,
  'survivorship-filter': SurvivorshipFilterSchema,
  'steelman-duel': SteelmanDuelSchema,
  'anatomy-labeler': AnatomyLabelerSchema,
  'counterfactual-fork': CounterfactualForkSchema,
  'budget-allocator': BudgetAllocatorSchema,
  'threshold-hunt': ThresholdHuntSchema,
} as const

export type SliderSimProps = z.infer<typeof SliderSimSchema>
export type PredictRevealProps = z.infer<typeof PredictRevealSchema>
export type BeforeAfterProps = z.infer<typeof BeforeAfterSchema>
export type EvidenceCardsProps = z.infer<typeof EvidenceCardsSchema>
export type TimelineProps = z.infer<typeof TimelineSchema>
export type TradeoffProps = z.infer<typeof TradeoffSchema>
export type DrawYourGuessProps = z.infer<typeof DrawYourGuessSchema>
export type ScaleLadderProps = z.infer<typeof ScaleLadderSchema>
export type BaseRateBoxProps = z.infer<typeof BaseRateBoxSchema>
export type FeedbackLoopStepperProps = z.infer<typeof FeedbackLoopStepperSchema>
export type DistributionVsAnecdoteProps = z.infer<typeof DistributionVsAnecdoteSchema>
export type RankTheListProps = z.infer<typeof RankTheListSchema>
export type OddsCalibratorProps = z.infer<typeof OddsCalibratorSchema>
export type CompoundingClockProps = z.infer<typeof CompoundingClockSchema>
export type SurvivorshipFilterProps = z.infer<typeof SurvivorshipFilterSchema>
export type SteelmanDuelProps = z.infer<typeof SteelmanDuelSchema>
export type AnatomyLabelerProps = z.infer<typeof AnatomyLabelerSchema>
export type CounterfactualForkProps = z.infer<typeof CounterfactualForkSchema>
export type BudgetAllocatorProps = z.infer<typeof BudgetAllocatorSchema>
export type ThresholdHuntProps = z.infer<typeof ThresholdHuntSchema>

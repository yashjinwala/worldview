// zod v4 mirrors of the six v1 template prop schemas, used ONLY as the Generator's
// structured-output format (zodOutputFormat runs zod/v4's toJSONSchema). Field shapes
// plus the load-bearing cross-field invariants. The frozen-tested zod v3 schemas in
// ./schemas.ts remain the authoritative gate: every generated artifact is re-validated
// against them server-side (pipeline.runSpawnArtifact) and on the client.

import { z } from 'zod/v4'

const common = {
  title: z.string(),
  caption: z.string().optional(),
  closingLine: z.string(),
  opensHook: z.string().optional(),
}

const GenSliderSim = z
  .object({
    ...common,
    variable: z.object({
      label: z.string(),
      min: z.number(),
      max: z.number(),
      step: z.number(),
      unit: z.string(),
      initial: z.number(),
    }),
    outcomes: z
      .array(z.object({ atOrBelow: z.number(), headline: z.string(), detail: z.string() }))
      .min(2)
      .max(5),
    referenceLines: z.array(z.object({ value: z.number(), label: z.string() })).optional(),
  })
  .refine((d) => d.variable.initial >= d.variable.min && d.variable.initial <= d.variable.max)
  .refine((d) => d.outcomes.every((o, i) => i === 0 || o.atOrBelow > d.outcomes[i - 1].atOrBelow))
  .refine((d) => d.outcomes[d.outcomes.length - 1].atOrBelow === d.variable.max)

const GenPredictReveal = z
  .object({
    ...common,
    question: z.string(),
    options: z.array(z.string()).min(3).max(4),
    correctIndex: z.number().int(),
    reveal: z.string(),
    whyYourGuessWasReasonable: z.string(),
  })
  .refine((d) => d.correctIndex >= 0 && d.correctIndex < d.options.length)

const GenBeforeAfter = z.object({
  ...common,
  before: z.object({ label: z.string(), body: z.string() }),
  after: z.object({ label: z.string(), body: z.string() }),
})

const GenEvidenceCards = z.object({
  ...common,
  claim: z.string(),
  cards: z
    .array(z.object({ headline: z.string(), body: z.string(), supports: z.boolean() }))
    .min(3)
    .max(6),
  verdict: z.string(),
})

const GenTimeline = z.object({
  ...common,
  events: z
    .array(z.object({ year: z.number(), yearLabel: z.string().optional(), label: z.string(), detail: z.string() }))
    .min(4)
    .max(10),
  pattern: z.string(),
})

const GenTradeoff = z.object({
  ...common,
  scenario: z.string(),
  optionA: z.object({ label: z.string(), consequences: z.array(z.string()).min(2).max(4) }),
  optionB: z.object({ label: z.string(), consequences: z.array(z.string()).min(2).max(4) }),
  insight: z.string(),
})

// ── phase-2 mirrors ──────────────────────────────────────────────────────────
const GenDrawYourGuess = z
  .object({
    ...common,
    xLabel: z.string(),
    yLabel: z.string(),
    xUnit: z.string().optional(),
    yUnit: z.string().optional(),
    knownPoints: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
    hiddenPoints: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
    reveal: z.string(),
  })
  .refine((d) => {
    const m = Math.max(...d.knownPoints.map((p) => p.x))
    return d.hiddenPoints.every((p) => p.x > m)
  })

const GenScaleLadder = z
  .object({
    ...common,
    subject: z.object({ label: z.string(), value: z.number(), unit: z.string() }),
    rungs: z.array(z.object({ label: z.string(), value: z.number(), emoji: z.string().optional() })).min(3).max(6),
  })
  .refine((d) => d.rungs.every((r, i) => i === 0 || r.value >= d.rungs[i - 1].value))

const genCell = z.object({ count: z.number().int(), label: z.string() })
const GenBaseRateBox = z
  .object({
    ...common,
    scenario: z.string(),
    populationLabel: z.string(),
    cells: z.object({ truePositive: genCell, falsePositive: genCell, trueNegative: genCell, falseNegative: genCell }),
    question: z.string(),
    intuitiveMisread: z.string(),
    insight: z.string(),
  })
  .refine((d) => d.cells.truePositive.count + d.cells.falsePositive.count + d.cells.trueNegative.count + d.cells.falseNegative.count <= 10000)

const GenFeedbackLoopStepper = z.object({
  ...common,
  loopType: z.enum(['reinforcing', 'balancing']),
  startingCondition: z.string(),
  steps: z
    .array(z.object({ id: z.string(), label: z.string(), description: z.string(), effect: z.enum(['increases', 'decreases', 'enables']) }))
    .min(4)
    .max(7),
  punchline: z.string(),
})

const GenDistributionVsAnecdote = z.object({
  ...common,
  xLabel: z.string(),
  xUnit: z.string().optional(),
  dataPoints: z.array(z.object({ value: z.number(), count: z.number() })).min(8).max(20),
  anecdote: z.object({ value: z.number(), label: z.string(), detail: z.string() }),
  insight: z.string(),
})

const GenRankTheList = z
  .object({
    ...common,
    question: z.string(),
    items: z.array(z.object({ id: z.string(), label: z.string(), detail: z.string().optional() })).min(4).max(7),
    correctRanking: z.array(z.string()),
    insight: z.string(),
  })
  .refine((d) => d.correctRanking.length === d.items.length)

const GenOddsCalibrator = z.object({
  ...common,
  claim: z.string(),
  isTrue: z.boolean(),
  reveal: z.string(),
  calibrationNote: z.string(),
})

const GenCompoundingClock = z.object({
  ...common,
  unit: z.string(),
  initialValue: z.number(),
  timeLabel: z.string(),
  timeSteps: z.number().int(),
  scenarios: z.array(z.object({ rate: z.number(), label: z.string(), color: z.string().optional() })).min(2).max(4),
  referenceValue: z.object({ value: z.number(), label: z.string() }).optional(),
})

const GenSurvivorshipFilter = z
  .object({
    ...common,
    startLabel: z.string(),
    startTotal: z.number(),
    stages: z.array(z.object({ label: z.string(), surviving: z.number(), dropped: z.number(), dropReason: z.string() })).min(3).max(5),
    visibleGroup: z.string(),
    insight: z.string(),
  })
  .refine((d) => {
    let input = d.startTotal
    for (const s of d.stages) {
      if (s.surviving + s.dropped !== input) return false
      input = s.surviving
    }
    return true
  })

const genDuelSide = z.object({ label: z.string(), points: z.array(z.string()).min(3).max(4) })
const GenSteelmanDuel = z.object({
  ...common,
  question: z.string(),
  sideA: genDuelSide,
  sideB: genDuelSide,
  synthesis: z.string(),
  consensusLeans: z.enum(['A', 'B', 'neither']).optional(),
})

const genRect = z.object({
  id: z.string(),
  shape: z.literal('rect'),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  fillColor: z.string(),
  label: z.string(),
  description: z.string(),
})
const genCircle = z.object({
  id: z.string(),
  shape: z.literal('circle'),
  cx: z.number(),
  cy: z.number(),
  r: z.number(),
  fillColor: z.string(),
  label: z.string(),
  description: z.string(),
})
const GenAnatomyLabeler = z.object({
  ...common,
  diagramLabel: z.string(),
  viewWidth: z.number(),
  viewHeight: z.number(),
  regions: z.array(z.discriminatedUnion('shape', [genRect, genCircle])).min(4).max(8),
  connections: z.array(z.object({ fromId: z.string(), toId: z.string(), label: z.string().optional() })).optional(),
})

const genForkPath = z.object({
  label: z.string(),
  events: z.array(z.object({ year: z.string(), outcome: z.string() })).min(3).max(5),
})
const GenCounterfactualFork = z.object({
  ...common,
  forkPoint: z.object({ year: z.string(), description: z.string() }),
  actualPath: genForkPath,
  counterfactualPath: genForkPath,
  insight: z.string(),
})

const GenBudgetAllocator = z
  .object({
    ...common,
    question: z.string(),
    totalLabel: z.string(),
    categories: z.array(z.object({ id: z.string(), label: z.string(), actualPercent: z.number(), hint: z.string().optional() })).min(4).max(8),
    insight: z.string(),
  })
  .refine((d) => Math.abs(d.categories.reduce((a, c) => a + c.actualPercent, 0) - 100) <= 0.01)

const GenThresholdHunt = z
  .object({
    ...common,
    question: z.string(),
    unit: z.string(),
    minValue: z.number(),
    maxValue: z.number(),
    thresholdValue: z.number(),
    belowLabel: z.string(),
    aboveLabel: z.string(),
    revealTolerance: z.number(),
    reveal: z.string(),
  })
  .refine((d) => d.thresholdValue > d.minValue && d.thresholdValue < d.maxValue)

export const GEN_SCHEMAS: Record<string, z.ZodType> = {
  'slider-sim': GenSliderSim,
  'predict-reveal': GenPredictReveal,
  'before-after': GenBeforeAfter,
  'evidence-cards': GenEvidenceCards,
  timeline: GenTimeline,
  tradeoff: GenTradeoff,
  'draw-your-guess': GenDrawYourGuess,
  'scale-ladder': GenScaleLadder,
  'base-rate-box': GenBaseRateBox,
  'feedback-loop-stepper': GenFeedbackLoopStepper,
  'distribution-vs-anecdote': GenDistributionVsAnecdote,
  'rank-the-list': GenRankTheList,
  'odds-calibrator': GenOddsCalibrator,
  'compounding-clock': GenCompoundingClock,
  'survivorship-filter': GenSurvivorshipFilter,
  'steelman-duel': GenSteelmanDuel,
  'anatomy-labeler': GenAnatomyLabeler,
  'counterfactual-fork': GenCounterfactualFork,
  'budget-allocator': GenBudgetAllocator,
  'threshold-hunt': GenThresholdHunt,
}

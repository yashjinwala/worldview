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

export const GEN_SCHEMAS: Record<string, z.ZodType> = {
  'slider-sim': GenSliderSim,
  'predict-reveal': GenPredictReveal,
  'before-after': GenBeforeAfter,
  'evidence-cards': GenEvidenceCards,
  timeline: GenTimeline,
  tradeoff: GenTradeoff,
}

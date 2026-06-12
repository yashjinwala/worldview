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

// ── registry: templateId → schema (the v1 six) ───────────────────────────────
export const TEMPLATE_SCHEMAS = {
  'slider-sim': SliderSimSchema,
  'predict-reveal': PredictRevealSchema,
  'before-after': BeforeAfterSchema,
  'evidence-cards': EvidenceCardsSchema,
  timeline: TimelineSchema,
  tradeoff: TradeoffSchema,
} as const

export type SliderSimProps = z.infer<typeof SliderSimSchema>
export type PredictRevealProps = z.infer<typeof PredictRevealSchema>
export type BeforeAfterProps = z.infer<typeof BeforeAfterSchema>
export type EvidenceCardsProps = z.infer<typeof EvidenceCardsSchema>
export type TimelineProps = z.infer<typeof TimelineSchema>
export type TradeoffProps = z.infer<typeof TradeoffSchema>

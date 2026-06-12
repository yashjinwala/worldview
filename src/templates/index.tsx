'use client'
// Artifact registry + card shell. Each template renders only its interactive body;
// this shell renders the card chrome (tag, title, caption, closingLine) uniformly and
// validates props on receipt (TDD §10: "Validation happens at artifact_ready receipt on
// the client"). Invalid props → the artifact is silently dropped.

import { ReactNode } from 'react'
import { TEMPLATE_SCHEMAS } from './schemas'
import { SliderSim } from './SliderSim'
import { PredictReveal } from './PredictReveal'
import { BeforeAfter } from './BeforeAfter'
import { EvidenceCards } from './EvidenceCards'
import { Timeline } from './Timeline'
import { Tradeoff } from './Tradeoff'
import { DrawYourGuess } from './DrawYourGuess'
import { ScaleLadder } from './ScaleLadder'
import { BaseRateBox } from './BaseRateBox'
import { FeedbackLoopStepper } from './FeedbackLoopStepper'
import { DistributionVsAnecdote } from './DistributionVsAnecdote'
import { RankTheList } from './RankTheList'
import { OddsCalibrator } from './OddsCalibrator'
import { CompoundingClock } from './CompoundingClock'
import { SurvivorshipFilter } from './SurvivorshipFilter'
import { SteelmanDuel } from './SteelmanDuel'
import { AnatomyLabeler } from './AnatomyLabeler'
import { CounterfactualFork } from './CounterfactualFork'
import { BudgetAllocator } from './BudgetAllocator'
import { ThresholdHunt } from './ThresholdHunt'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BODIES: Record<string, (p: { props: any }) => ReactNode> = {
  'slider-sim': SliderSim,
  'predict-reveal': PredictReveal,
  'before-after': BeforeAfter,
  'evidence-cards': EvidenceCards,
  timeline: Timeline,
  tradeoff: Tradeoff,
  'draw-your-guess': DrawYourGuess,
  'scale-ladder': ScaleLadder,
  'base-rate-box': BaseRateBox,
  'feedback-loop-stepper': FeedbackLoopStepper,
  'distribution-vs-anecdote': DistributionVsAnecdote,
  'rank-the-list': RankTheList,
  'odds-calibrator': OddsCalibrator,
  'compounding-clock': CompoundingClock,
  'survivorship-filter': SurvivorshipFilter,
  'steelman-duel': SteelmanDuel,
  'anatomy-labeler': AnatomyLabeler,
  'counterfactual-fork': CounterfactualFork,
  'budget-allocator': BudgetAllocator,
  'threshold-hunt': ThresholdHunt,
}

const STANDING_PROVENANCE = 'from model knowledge — figures approximate'

export function validateArtifactProps(templateId: string, props: unknown): Record<string, unknown> | null {
  const schema = (TEMPLATE_SCHEMAS as Record<string, { safeParse: (v: unknown) => { success: boolean; data?: unknown } }>)[templateId]
  if (!schema) return null
  const parsed = schema.safeParse(props)
  return parsed.success ? (parsed.data as Record<string, unknown>) : null
}

export function ArtifactCard({
  templateId,
  props,
  status = 'ready',
}: {
  templateId: string
  props: Record<string, unknown>
  status?: string
}) {
  const Body = BODIES[templateId]
  if (status === 'generating') {
    return (
      <div className="wv-artifact-card building">
        <div className="wv-artifact-head">
          <span className="wv-artifact-tag">interactive · {templateId}</span>
          <h2 className="wv-artifact-title">Building an interactive…</h2>
        </div>
        <div className="wv-artifact-body">
          <div className="wv-artifact-building">
            <span className="wv-shimmer" />
            building…
          </div>
        </div>
      </div>
    )
  }

  const valid = validateArtifactProps(templateId, props)
  if (!Body || !valid) return null

  const title = String(valid.title ?? '')
  const caption = (valid.caption as string | undefined) ?? null
  const closingLine = String(valid.closingLine ?? '')

  return (
    <div className="wv-artifact-card">
      <div className="wv-artifact-head">
        <span className="wv-artifact-tag">interactive · {templateId}</span>
        <h2 className="wv-artifact-title">{title}</h2>
      </div>
      <div className="wv-artifact-body">
        <Body props={valid} />
        <div className="wv-artifact-caption">{caption ?? STANDING_PROVENANCE}</div>
      </div>
      <div className="wv-artifact-foot">
        <p className="wv-artifact-closing">{closingLine}</p>
      </div>
    </div>
  )
}

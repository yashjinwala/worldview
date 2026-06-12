// Shared types mirroring the spec (TDD §7, §8) and the test harness contract.

export type Posture = 'understand' | 'challenge' | 'deep-dive' | 'surprise-me'

export type TutorMode = 'explain' | 'challenge' | 'provoke' | 'socratic' | 'support'

export type Appetite = 'leaning_in' | 'neutral' | 'restless'

export interface ReaderOutput {
  appetite: Appetite
  proximityToClose: number
  justClosed: boolean
  closedLoopId?: string | null
  conversationNodeId: string | null
  positionShift?: string | null
  inferredPosition?: string | null
  synthesisAnswer?: string | null
  evidence: string
}

export interface DirectorToolCall {
  name: string
  input: Record<string, unknown>
}

export interface UserModelData {
  modesThatLand: Record<string, number>
  pacing: 'fast' | 'moderate' | 'deliberate'
  styleNotes: string[]
  clickPatterns: string[]
  interests: string[]
  vocabularyLevel: 'plain' | 'comfortable' | 'technical'
}

export interface ProfilerOutput {
  data: UserModelData
  resumeSummary: string
}

export interface SafetyOutput {
  flag: boolean
  category: 'fabrication' | 'advice' | 'distress' | null
  note: string | null
}

export interface GeneratorNode {
  title: string
  summary: string
  hookQuestion: string
}

export interface GeneratorMapOutput {
  nodes: GeneratorNode[]
}

// The §10 catalog. The first six shipped in v1; the remaining fourteen are the
// phase-2 build, now complete — the Director/Generator select from all twenty.
export const V1_TEMPLATE_IDS = [
  'slider-sim',
  'predict-reveal',
  'before-after',
  'evidence-cards',
  'timeline',
  'tradeoff',
] as const

export const TEMPLATE_IDS = [
  ...V1_TEMPLATE_IDS,
  'draw-your-guess',
  'scale-ladder',
  'base-rate-box',
  'feedback-loop-stepper',
  'distribution-vs-anecdote',
  'rank-the-list',
  'odds-calibrator',
  'compounding-clock',
  'survivorship-filter',
  'steelman-duel',
  'anatomy-labeler',
  'counterfactual-fork',
  'budget-allocator',
  'threshold-hunt',
] as const

export type TemplateId = (typeof TEMPLATE_IDS)[number]

export const DEFAULT_USER_MODEL: UserModelData = {
  modesThatLand: { explain: 0, challenge: 0, provoke: 0, socratic: 0, support: 0 },
  pacing: 'moderate',
  styleNotes: [],
  clickPatterns: [],
  interests: [],
  vocabularyLevel: 'comfortable',
}

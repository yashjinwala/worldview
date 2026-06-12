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

// The six v1 templates (TDD §10). The selectable TemplateId union is the v1 six only.
export const V1_TEMPLATE_IDS = [
  'slider-sim',
  'predict-reveal',
  'before-after',
  'evidence-cards',
  'timeline',
  'tradeoff',
] as const

export type TemplateId = (typeof V1_TEMPLATE_IDS)[number]

export const DEFAULT_USER_MODEL: UserModelData = {
  modesThatLand: { explain: 0, challenge: 0, provoke: 0, socratic: 0, support: 0 },
  pacing: 'moderate',
  styleNotes: [],
  clickPatterns: [],
  interests: [],
  vocabularyLevel: 'comfortable',
}

// Cost model (TDD §13). Real `usage` flows through these constants into
// Session.costUsd after every API response — including under mock, so the cost
// tests exercise production accounting (tests/README "Cost accounting under mock").

export interface UsageTokens {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
}

// Per-token rates ($/token).
export const SONNET_IN_PER_TOK = 3 / 1_000_000 //   $3 / MTok
export const SONNET_OUT_PER_TOK = 15 / 1_000_000 // $15 / MTok
export const SONNET_CACHE_READ_PER_TOK = 0.3 / 1_000_000 // ~$0.30 / MTok (cached prefix)
export const HAIKU_IN_PER_TOK = 1 / 1_000_000 //    $1 / MTok
export const HAIKU_OUT_PER_TOK = 5 / 1_000_000 //   $5 / MTok
export const HAIKU_CACHE_READ_PER_TOK = 0.1 / 1_000_000

// Only the Tutor is Sonnet-class; every other role is Haiku-class (TDD §2 models row).
export function costOf(usage: UsageTokens | undefined, sonnet: boolean): number {
  if (!usage) return 0
  const inRate = sonnet ? SONNET_IN_PER_TOK : HAIKU_IN_PER_TOK
  const outRate = sonnet ? SONNET_OUT_PER_TOK : HAIKU_OUT_PER_TOK
  const cacheRate = sonnet ? SONNET_CACHE_READ_PER_TOK : HAIKU_CACHE_READ_PER_TOK
  return (
    (usage.input_tokens || 0) * inRate +
    (usage.output_tokens || 0) * outRate +
    (usage.cache_read_input_tokens || 0) * cacheRate
  )
}

export const SESSION_COST_LIMIT_USD = Number(process.env.SESSION_COST_LIMIT ?? '2.0')
export const SESSION_COST_NEAR_USD = Number(process.env.SESSION_COST_NEAR ?? '1.6')
export const GLOBAL_DAILY_LIMIT_USD = Number(process.env.GLOBAL_DAILY_LIMIT_USD ?? '20')

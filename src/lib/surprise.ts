// "Surprise me" rotation (TDD §9, hardcoded array, round-robin). Each entry becomes
// the held question + the turn-1 provoke hook. The session-3+ interest-matching pick
// (G-08) is a documented v1 simplification — see BUILD_NOTES.md.

export const SURPRISE_ROTATION: string[] = [
  'Why the price of eggs is a geopolitics story',
  "Why you can't tickle yourself",
  'Why Japan owes 260% of GDP and nothing happened',
  'The traffic jam that has no cause',
  'Why password rules make passwords weaker',
  'Did medieval peasants really work fewer hours than you?',
  'Why planes have gotten slower since 1960',
  'The country that abolished its army and got safer',
]

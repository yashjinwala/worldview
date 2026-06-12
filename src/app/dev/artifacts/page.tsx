'use client'
// /dev/artifacts — renders all six v1 templates from sample props (TDD §16 item 4).
// Examples mirror the §10 specs (and avoid the duty-of-care issues the spec flags).

import { ArtifactCard } from '@/templates'

const SAMPLES: Array<{ templateId: string; props: Record<string, unknown> }> = [
  {
    templateId: 'slider-sim',
    props: {
      title: 'When does the interest become the problem?',
      caption: '~$35T outstanding (2024 est.); interest = rate × principal.',
      closingLine: 'So the danger was never the number — it is the rate. What sets the rate?',
      variable: { label: 'Avg. interest rate on US debt', min: 1, max: 8, step: 0.1, unit: '%', initial: 3.2 },
      outcomes: [
        { atOrBelow: 2.5, headline: 'Heavy but manageable.', detail: 'Below the Pentagon’s annual budget, but the gap narrows fast.' },
        { atOrBelow: 4.3, headline: 'Interest now exceeds the entire defense budget.', detail: 'More than every weapon, soldier, and base combined ($850B).' },
        { atOrBelow: 8, headline: 'Interest eats the budget from the inside.', detail: 'Servicing the debt costs more than all discretionary spending combined.' },
      ],
      referenceLines: [{ value: 3.2, label: 'today' }],
    },
  },
  {
    templateId: 'predict-reveal',
    props: {
      title: 'What share of the world lived in extreme poverty in 2020?',
      caption: 'World Bank, 2020 ($2.15/day, 2017 PPP).',
      closingLine: 'The trend almost no one tracks: it has fallen by more than half since 1990.',
      question: 'What share of the world lived in extreme poverty in 2020?',
      options: ['About 10%', 'About 30%', 'About 50%', 'About 70%'],
      correctIndex: 0,
      reveal: 'Roughly 9–10% — down from ~36% in 1990. The decline is one of the least-reported trends of our era.',
      whyYourGuessWasReasonable: 'News coverage tracks crises, not slow trendlines, so most people overestimate badly.',
    },
  },
  {
    templateId: 'before-after',
    props: {
      title: 'Vaccine side-effect risk — two framings',
      closingLine: 'The same number feels entirely different once you have something to compare it to.',
      before: { label: 'The intuitive framing', body: 'The vaccine carries about a 1-in-1,000,000 chance of myocarditis. Stated alone, that sounds alarming.' },
      after: { label: 'The accurate framing', body: 'The disease itself causes myocarditis roughly 200× more often. Against that baseline, the vaccine is the safer option.' },
    },
  },
  {
    templateId: 'evidence-cards',
    props: {
      title: 'Does social media cause teen depression?',
      closingLine: 'The evidence is messier than either side admits — which is the actually interesting part.',
      claim: 'Social media causes teen depression.',
      cards: [
        { headline: 'Correlation study (2018)', body: 'Heavy users were ~2× more likely to report depressive symptoms.', supports: true },
        { headline: 'Reverse-causation finding', body: 'Already-depressed teens use social media more — cause and effect may run backwards.', supports: false },
        { headline: 'Randomized reduction trial', body: 'Cutting usage in a controlled trial did not measurably reduce depression scores.', supports: false },
        { headline: 'Platform-specific finding', body: 'Image-first platforms were specifically linked to body-image distress in girls.', supports: true },
        { headline: 'Null longitudinal result', body: 'A large multi-year cohort found no population-level effect on wellbeing.', supports: false },
      ],
      verdict: 'Correlation is real and some harms are specific, but a clean population-level causal effect has not been established.',
    },
  },
  {
    templateId: 'timeline',
    props: {
      title: 'US debt ceiling: same movie, different cast',
      closingLine: 'Resolved every time, always at the last moment — so far.',
      events: [
        { year: 1917, label: 'Debt ceiling created', detail: 'Congress sets a cap to streamline WWI borrowing.' },
        { year: 1939, label: 'First major increase', detail: 'New Deal spending pushes Congress to raise the ceiling.' },
        { year: 1979, label: 'Technical default scare', detail: 'A check-processing backlog causes a brief technical default.' },
        { year: 2011, label: 'S&P downgrade', detail: 'US credit rating cut for the first time after a near-miss.' },
        { year: 2023, label: 'X-date standoff', detail: 'A deal is reached hours before the projected default date.' },
      ],
      pattern: 'Resolved every time, always at the last moment — so far.',
    },
  },
  {
    templateId: 'tradeoff',
    props: {
      title: 'Central bank rate decision: raise or hold?',
      closingLine: 'There is no free lunch — only which costs you are willing to bear.',
      scenario: 'Inflation is running at 6%. The central bank must decide whether to raise rates or hold.',
      optionA: {
        label: 'Raise rates',
        consequences: ['Inflation falls over 12–18 months', 'Unemployment rises 1–2 points', 'Currency strengthens', 'Corporate debt stress increases'],
      },
      optionB: {
        label: 'Hold rates',
        consequences: ['Inflation persists, eroding savings', 'Asset prices keep rising', 'Currency weakens vs. peers'],
      },
      insight: 'Both options impose real costs on real people; the choice is about which group bears them.',
    },
  },
]

export default function DevArtifacts() {
  return (
    <div className="wv-dev-grid">
      {SAMPLES.map((s) => (
        <div key={s.templateId}>
          <ArtifactCard templateId={s.templateId} props={s.props} />
        </div>
      ))}
    </div>
  )
}

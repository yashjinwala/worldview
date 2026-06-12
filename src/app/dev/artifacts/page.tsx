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
  {
    templateId: 'draw-your-guess',
    props: {
      title: 'How fast did child mortality actually fall?',
      caption: 'Our World in Data; share of children dying before age 5.',
      closingLine: 'Almost everyone underestimates the fall — it is one of the least-felt good-news trends.',
      xLabel: 'Year',
      yLabel: '% dying before age 5',
      knownPoints: [{ x: 1800, y: 43 }, { x: 1850, y: 42 }, { x: 1900, y: 36 }, { x: 1950, y: 22 }, { x: 1960, y: 18 }],
      hiddenPoints: [{ x: 1980, y: 11 }, { x: 2000, y: 7 }, { x: 2020, y: 3.7 }],
      reveal: 'From ~18% in 1960 to under 4% today — a collapse most people sketch as a gentle slope.',
    },
  },
  {
    templateId: 'scale-ladder',
    props: {
      title: 'How much is a trillion dollars?',
      caption: 'Approximate 2024 figures, USD.',
      closingLine: 'The number only means something once it has a ladder to stand against.',
      subject: { label: 'US national debt', value: 33_000_000_000_000, unit: 'dollars' },
      rungs: [
        { label: 'Annual federal budget', value: 6_500_000_000_000, emoji: '🏛️' },
        { label: 'US GDP', value: 26_000_000_000_000, emoji: '🇺🇸' },
        { label: 'Global GDP', value: 100_000_000_000_000, emoji: '🌍' },
        { label: 'Estimated total global wealth', value: 454_000_000_000_000, emoji: '💰' },
      ],
    },
  },
  {
    templateId: 'base-rate-box',
    props: {
      title: 'You tested positive. What are the odds?',
      caption: 'Mammography screening, illustrative 1,000-woman cohort.',
      closingLine: 'A 90%-accurate test on a rare condition still leaves you more likely fine than not.',
      scenario: 'A screening test for a condition that affects about 1 in 100 people.',
      populationLabel: '1,000 people',
      cells: {
        truePositive: { count: 9, label: 'Sick, correctly flagged' },
        falsePositive: { count: 89, label: 'Healthy, falsely flagged' },
        trueNegative: { count: 901, label: 'Healthy, correctly cleared' },
        falseNegative: { count: 1, label: 'Sick, missed' },
      },
      question: 'You got a positive result — what is the chance you actually have it?',
      intuitiveMisread: 'Most people say ~90%, anchoring on the test’s accuracy.',
      insight: 'It is 9 ÷ (9 + 89) ≈ 9%. The base rate swamps the test’s accuracy.',
    },
  },
  {
    templateId: 'feedback-loop-stepper',
    props: {
      title: 'Anatomy of a bank run',
      closingLine: 'Each turn makes the next more likely — the fear becomes the cause.',
      loopType: 'reinforcing',
      startingCondition: 'Imagine deposits at a healthy bank fall slightly.',
      steps: [
        { id: 'drop', label: 'Deposits fall', description: 'A few depositors withdraw, for unrelated reasons.', effect: 'enables' },
        { id: 'sell', label: 'Bank sells assets', description: 'To cover withdrawals, the bank sells assets quickly.', effect: 'increases' },
        { id: 'prices', label: 'Asset prices drop', description: 'Forced selling pushes the price of those assets down.', effect: 'increases' },
        { id: 'weak', label: 'Bank looks weaker', description: 'Lower asset values make the bank look less solvent.', effect: 'increases' },
        { id: 'more', label: 'More withdrawals', description: 'Worried depositors pull their money — back to the start.', effect: 'increases' },
      ],
      punchline: 'A reinforcing loop: a small, survivable shock amplifies itself into a collapse.',
    },
  },
  {
    templateId: 'distribution-vs-anecdote',
    props: {
      title: 'Is CEO pay really that high?',
      caption: 'S&P 500 CEO compensation, illustrative distribution.',
      closingLine: 'One famous number can hide the entire shape of the thing it claims to describe.',
      xLabel: 'Annual CEO pay',
      xUnit: '$M',
      dataPoints: [
        { value: 5, count: 40 }, { value: 8, count: 70 }, { value: 11, count: 95 }, { value: 14, count: 110 },
        { value: 17, count: 80 }, { value: 22, count: 55 }, { value: 28, count: 30 }, { value: 35, count: 18 },
        { value: 45, count: 10 }, { value: 60, count: 6 }, { value: 90, count: 3 }, { value: 150, count: 2 },
      ],
      anecdote: { value: 56000, label: 'Elon Musk', detail: 'His 2018 Tesla grant was worth roughly $56B — about 3,700× the median package.' },
      insight: 'The median S&P 500 package is ~$15M; the famous outlier sits invisibly off the chart.',
    },
  },
  {
    templateId: 'rank-the-list',
    props: {
      title: 'Rank these by murder rate, highest first',
      caption: 'Homicide rates per 100k, recent years.',
      closingLine: 'The ranking your gut produces says more about the news than about the world.',
      question: 'Rank these countries by homicide rate, highest first.',
      items: [
        { id: 'usa', label: 'United States', detail: '~6.4 per 100k' },
        { id: 'jpn', label: 'Japan', detail: '~0.3 per 100k' },
        { id: 'bra', label: 'Brazil', detail: '~22 per 100k' },
        { id: 'gbr', label: 'United Kingdom', detail: '~1.2 per 100k' },
        { id: 'mex', label: 'Mexico', detail: '~26 per 100k' },
      ],
      correctRanking: ['mex', 'bra', 'usa', 'gbr', 'jpn'],
      insight: 'Most people underrank Mexico and Brazil and overrank the US — coverage isn’t incidence.',
    },
  },
  {
    templateId: 'odds-calibrator',
    props: {
      title: 'How sure are you?',
      caption: 'Lightning: ~2,000 deaths/year globally; sharks: ~5.',
      closingLine: 'Overconfidence on surprising-sounding claims is systematic, not a personal failing.',
      claim: 'Sharks kill more people annually than lightning.',
      isTrue: false,
      reveal: 'False. Lightning kills around 2,000 people a year worldwide; sharks kill about five.',
      calibrationNote: 'People are overconfident on surprising-sounding animal claims roughly two-thirds of the time.',
    },
  },
  {
    templateId: 'compounding-clock',
    props: {
      title: 'Why the rate matters more than you think',
      caption: '$10,000 invested, compounded annually.',
      closingLine: 'A few points of rate, given enough time, isn’t a small difference — it’s a different universe.',
      unit: 'dollars',
      initialValue: 10000,
      timeLabel: 'Years',
      timeSteps: 40,
      scenarios: [
        { rate: 0.04, label: '4% — savings account' },
        { rate: 0.07, label: '7% — index fund' },
        { rate: 0.1, label: '10% — aggressive' },
      ],
      referenceValue: { value: 100000, label: '10× starting amount' },
    },
  },
  {
    templateId: 'survivorship-filter',
    props: {
      title: 'The restaurants you never hear about',
      caption: 'Illustrative NYC restaurant cohort.',
      closingLine: 'The visible survivors look like destiny only because the failures left the frame.',
      startLabel: 'All restaurants opened in NYC in 2010',
      startTotal: 1000,
      stages: [
        { label: 'Still open after year 1', surviving: 800, dropped: 200, dropReason: 'Undercapitalized — ran out of runway before regulars formed.' },
        { label: 'Still open after year 3', surviving: 500, dropped: 300, dropReason: 'Rent hikes and thin margins closed the squeezed middle.' },
        { label: 'Still open after year 5', surviving: 300, dropped: 200, dropReason: 'Neighborhood shifts and burnout took the rest.' },
      ],
      visibleGroup: 'The restaurants we review on Yelp',
      insight: 'Studying only survivors, you’d conclude the recipe for success is whatever they happened to do.',
    },
  },
  {
    templateId: 'steelman-duel',
    props: {
      title: 'Does foreign aid help or hurt?',
      closingLine: 'The click is realizing the question is genuinely contested — not one side being foolish.',
      question: 'Does foreign aid help or hurt developing economies?',
      sideA: {
        label: 'Aid helps',
        points: [
          'Direct health aid (vaccines, bed nets) has measurably cut child mortality.',
          'Infrastructure financing builds roads and grids markets can’t fund alone.',
          'Emergency aid prevents famine deaths that markets never prevent in time.',
        ],
      },
      sideB: {
        label: 'Aid hurts',
        points: [
          'Large inflows can prop up corrupt governments and weaken accountability.',
          'Aid can cause "Dutch disease," raising the currency and hurting exporters.',
          'Dependency can crowd out the local institutions that drive lasting growth.',
        ],
      },
      synthesis: 'The honest answer depends heavily on aid type and institutional context — health aid looks very different from general budget support.',
      consensusLeans: 'neither',
    },
  },
  {
    templateId: 'anatomy-labeler',
    props: {
      title: 'How blood moves through the heart',
      closingLine: 'Once you can point to each part, the circuit stops being a diagram and becomes a path.',
      diagramLabel: 'The human heart, simplified',
      viewWidth: 800,
      viewHeight: 500,
      regions: [
        { id: 'ra', shape: 'rect', x: 120, y: 90, w: 220, h: 150, fillColor: '#384a5e', label: 'Right atrium', description: 'Receives oxygen-poor blood returning from the body.' },
        { id: 'rv', shape: 'rect', x: 120, y: 270, w: 220, h: 150, fillColor: '#58789e', label: 'Right ventricle', description: 'Pumps that blood to the lungs to pick up oxygen.' },
        { id: 'la', shape: 'rect', x: 460, y: 90, w: 220, h: 150, fillColor: '#7a3a2e', label: 'Left atrium', description: 'Receives oxygen-rich blood back from the lungs.' },
        { id: 'lv', shape: 'rect', x: 460, y: 270, w: 220, h: 150, fillColor: '#e07040', label: 'Left ventricle', description: 'The strongest chamber — pumps oxygenated blood to the whole body.' },
        { id: 'tv', shape: 'circle', cx: 230, cy: 255, r: 22, fillColor: '#3d7a52', label: 'Tricuspid valve', description: 'One-way gate between the right atrium and ventricle.' },
        { id: 'mv', shape: 'circle', cx: 570, cy: 255, r: 22, fillColor: '#9c6830', label: 'Mitral valve', description: 'One-way gate between the left atrium and ventricle.' },
      ],
      connections: [
        { fromId: 'rv', toId: 'la', label: 'to the lungs' },
        { fromId: 'lv', toId: 'ra', label: 'to the body' },
      ],
    },
  },
  {
    templateId: 'counterfactual-fork',
    props: {
      title: 'The dish Fleming almost threw away',
      closingLine: 'Whole eras can hinge on whether one person looks twice at an accident.',
      forkPoint: { year: '1928', description: 'Fleming notices mold has killed bacteria on a contaminated Petri dish — and pauses instead of discarding it.' },
      actualPath: {
        label: 'What happened',
        events: [
          { year: '1928', outcome: 'Penicillin’s effect is recorded.' },
          { year: '1940s', outcome: 'Mass production begins; infected wounds become survivable.' },
          { year: '1945', outcome: 'Antibiotics save millions of WWII casualties.' },
          { year: 'Today', outcome: 'Routine surgery and chemotherapy depend on antibiotics.' },
        ],
      },
      counterfactualPath: {
        label: 'If the dish had gone in the bin',
        events: [
          { year: '1928', outcome: 'The observation is lost; no follow-up.' },
          { year: '1940s', outcome: 'WWII infection deaths run far higher.' },
          { year: '1950s+', outcome: 'The antibiotic era arrives a decade or more later.' },
          { year: 'Today', outcome: 'Modern surgery develops on a very different timeline.' },
        ],
      },
      insight: 'Contingency, not inevitability: a single careful glance shifted millions of lives.',
    },
  },
  {
    templateId: 'budget-allocator',
    props: {
      title: 'How big is the foreign-aid slice, really?',
      caption: 'Approximate US federal outlays, illustrative.',
      closingLine: 'The gap between what you guessed and the real 1% is the whole point.',
      question: 'How does the US federal government spend each dollar?',
      totalLabel: '100 cents of every federal dollar',
      categories: [
        { id: 'ss', label: 'Social Security', actualPercent: 22, hint: 'The single largest line.' },
        { id: 'health', label: 'Medicare & Medicaid', actualPercent: 24 },
        { id: 'def', label: 'Defense', actualPercent: 13 },
        { id: 'int', label: 'Interest on the debt', actualPercent: 10, hint: 'Growing fast as rates rise.' },
        { id: 'mand', label: 'Other mandatory', actualPercent: 16 },
        { id: 'disc', label: 'Other discretionary', actualPercent: 14 },
        { id: 'aid', label: 'Foreign aid', actualPercent: 1, hint: 'Most people guess 10–25%.' },
      ],
      insight: 'Foreign aid is about 1% — a rounding error next to where the money actually goes.',
    },
  },
  {
    templateId: 'threshold-hunt',
    props: {
      title: 'How deep does the light reach?',
      caption: 'The ocean’s photic zone; light attenuation with depth.',
      closingLine: 'You don’t just learn the number — you feel where the tipping point sits.',
      question: 'Below what depth does sunlight stop supporting photosynthesis?',
      unit: 'm',
      minValue: 0,
      maxValue: 1000,
      thresholdValue: 200,
      belowLabel: 'enough light to photosynthesize',
      aboveLabel: 'perpetual twilight — no net photosynthesis',
      revealTolerance: 50,
      reveal: 'Around 200m. Below it, light is too faint for net photosynthesis — which is why most ocean life crowds the sunlit top layer.',
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

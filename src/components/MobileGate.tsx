'use client'
// Phone-viewport gate (TDD §9). The kill test runs desktop-only (PRD §10), so phones
// get a gentle "built for a bigger screen" note with a continue-anyway escape.

export default function MobileGate({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="wv-mobile-gate">
      <div className="wv-onboard-logo">Worldview</div>
      <h1>Built for a bigger screen.</h1>
      <p>The map and the conversation want room to breathe — grab a laptop when the question comes back.</p>
      <a onClick={onContinue}>continue anyway →</a>
    </div>
  )
}

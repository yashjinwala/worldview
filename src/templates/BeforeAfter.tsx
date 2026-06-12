'use client'

import { useState } from 'react'
import { BeforeAfterProps } from './schemas'

type Tab = 'before' | 'after'

export function BeforeAfter({ props }: { props: BeforeAfterProps }) {
  const [active, setActive] = useState<Tab>('before')

  const tabs: { key: Tab; label: string; body: string }[] = [
    { key: 'before', label: props.before.label, body: props.before.body },
    { key: 'after', label: props.after.label, body: props.after.body },
  ]

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: '2px',
    marginBottom: '12px',
    padding: '3px',
    backgroundColor: 'var(--color-s1)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
  }

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '6px 16px',
    fontSize: '13px',
    fontFamily: 'var(--font-sans)',
    fontWeight: isActive ? 500 : 400,
    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    backgroundColor: isActive ? 'var(--color-s3)' : 'var(--tab-inactive-bg)',
    border: isActive
      ? '1px solid var(--color-ember-dim)'
      : '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
    textAlign: 'center',
    lineHeight: 1.35,
    outline: 'none',
  })

  // Grid stacking: both panels share the same cell so height = max of both.
  // No height jump on crossfade — opacity-only transition.
  const gridContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr',
  }

  const panelStyle = (isActive: boolean): React.CSSProperties => ({
    gridArea: '1 / 1',
    opacity: isActive ? 1 : 0,
    transition: 'opacity 150ms cubic-bezier(0.4,0,0.2,1)',
    pointerEvents: isActive ? 'auto' : 'none',
    backgroundColor: 'var(--color-s2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    fontSize: '14px',
    fontFamily: 'var(--font-sans)',
    lineHeight: 1.6,
    color: 'var(--color-text-primary)',
    whiteSpace: 'pre-wrap',
  })

  return (
    <div>
      <div style={tabBarStyle} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            style={tabStyle(active === tab.key)}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={gridContainerStyle}>
        {tabs.map((tab) => (
          <div
            key={tab.key}
            role="tabpanel"
            aria-hidden={active !== tab.key}
            style={panelStyle(active === tab.key)}
          >
            {tab.body}
          </div>
        ))}
      </div>
    </div>
  )
}

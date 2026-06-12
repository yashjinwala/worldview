'use client'
// Top-level orchestrator: mobile gate · shelf · onboarding · session. Anonymous local
// identity; first-time users skip the shelf and land straight in onboarding (§9).

import { useEffect, useState } from 'react'
import Onboarding from '@/components/Onboarding'
import Shelf from '@/components/Shelf'
import Session from '@/components/Session'
import MobileGate from '@/components/MobileGate'
import { getUserId, fetchMaps, endSession, isPhoneViewport } from '@/lib/client'

type View =
  | { name: 'loading' }
  | { name: 'gate' }
  | { name: 'shelf' }
  | { name: 'onboarding' }
  | { name: 'session'; mapId: string; sessionId: string; kickoff: { message: string; viaShelf: boolean } }

export default function Home() {
  const [userId, setUserId] = useState('')
  const [view, setView] = useState<View>({ name: 'loading' })

  useEffect(() => {
    const id = getUserId()
    setUserId(id)
    if (isPhoneViewport() && !sessionStorage.getItem('wv_mobile_continued')) {
      setView({ name: 'gate' })
      return
    }
    void boot(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const boot = async (id: string) => {
    try {
      const data = await fetchMaps(id)
      setView(data.maps.length > 0 ? { name: 'shelf' } : { name: 'onboarding' })
    } catch {
      setView({ name: 'onboarding' })
    }
  }

  const openMap = async (mapId: string, lastSessionId: string | null) => {
    setView({ name: 'loading' })
    if (lastSessionId) await endSession(lastSessionId) // ensure ended → return session w/ welcome-back
    setView({
      name: 'session',
      mapId,
      sessionId: lastSessionId ?? '',
      kickoff: { message: "I'm back — where did we leave off?", viaShelf: true },
    })
  }

  if (view.name === 'loading') return <div className="wv-screen"><span className="wv-spinner" /></div>

  if (view.name === 'gate')
    return (
      <MobileGate
        onContinue={() => {
          sessionStorage.setItem('wv_mobile_continued', '1')
          setView({ name: 'loading' })
          void boot(userId)
        }}
      />
    )

  if (view.name === 'shelf')
    return (
      <Shelf
        userId={userId}
        onOpen={openMap}
        onNew={() => setView({ name: 'onboarding' })}
      />
    )

  if (view.name === 'onboarding')
    return (
      <Onboarding
        userId={userId}
        onStart={(info) => setView({ name: 'session', ...info })}
        onCancel={() => setView({ name: 'shelf' })}
      />
    )

  return (
    <Session
      key={view.mapId}
      mapId={view.mapId}
      sessionId={view.sessionId}
      kickoff={view.kickoff}
      onExit={() => setView({ name: 'shelf' })}
    />
  )
}

// Home route — real UI (onboarding / shelf / session) is built in src/app/home.tsx.
import Home from './home'

export const dynamic = 'force-dynamic'

export default function Page() {
  return <Home />
}

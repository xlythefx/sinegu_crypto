import { useEffect } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useApiData } from '../hooks/useApiData'
import { fetchLandingTrackRecord } from '../services/publicStats'
import Ticker from '../components/landing/Ticker'
import Footer from '../components/landing/Footer'
import NavNext from '../components/landing-next/NavNext'
import HeroNext from '../components/landing-next/HeroNext'
import HeroPhoto from '../components/landing-next/HeroPhoto'
import RecentCloses from '../components/landing-next/RecentCloses'
import SignalFlow from '../components/landing-next/SignalFlow'
import KeyPermissions from '../components/landing-next/KeyPermissions'
import FeeExample from '../components/landing-next/FeeExample'
import TrackRecordNext from '../components/landing-next/TrackRecordNext'
import GettingStarted from '../components/landing-next/GettingStarted'

/**
 * The home page, `/` (redesigned 2026-11-25, live 2026-11-27 — it was the
 * hidden preview at `/preview/landing`, which now redirects here). The page it
 * replaced stays at `/classic` (`pages/LandingClassic.tsx`, noindex); the tag
 * `landing-classic` marks the code before the redesign.
 *
 * One fetch for the whole page: the quote strip, the latest-trades strip and
 * the record section all read one track record, so they can never show two
 * different results.
 */
export default function Landing() {
  const { data: record, loading, error } = useApiData(fetchLandingTrackRecord)

  useEffect(() => {
    AOS.init({ duration: 600, once: true, offset: 60, easing: 'ease-out-cubic' })
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-bg text-text transition-[background,color] duration-[400ms]">
      <Ticker stats={record?.stats ?? null} series={record?.series ?? []} />
      {/* One backdrop behind the nav AND the hero, so the photo has no seam
          under the nav. `isolate` keeps its -z layer inside this header. */}
      <header className="relative isolate">
        <HeroPhoto />
        <NavNext />
        <HeroNext />
      </header>
      <main>
        <RecentCloses closes={record?.recent_closes ?? []} loading={loading} error={error} />
        <SignalFlow />
        <KeyPermissions />
        <FeeExample />
        <TrackRecordNext record={record} loading={loading} error={error} />
        <GettingStarted />
      </main>
      <Footer
        maxWidth="max-w-[1200px]"
        blurb="Automated futures trading on your own exchange account. You pay only out of profit, in a month that ends at a new high."
      />
    </div>
  )
}

import { useEffect } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useApiData } from '../hooks/useApiData'
import { fetchLandingTrackRecord } from '../services/publicStats'
import Ticker from '../components/landing/Ticker'
import Footer from '../components/landing/Footer'
import NavNext from '../components/landing-next/NavNext'
import HeroNext from '../components/landing-next/HeroNext'
import RecentCloses from '../components/landing-next/RecentCloses'
import SignalFlow from '../components/landing-next/SignalFlow'
import KeyPermissions from '../components/landing-next/KeyPermissions'
import FeeExample from '../components/landing-next/FeeExample'
import TrackRecordNext from '../components/landing-next/TrackRecordNext'
import GettingStarted from '../components/landing-next/GettingStarted'

/**
 * Keeps search engines off the preview while it is open — the live home page
 * is still `/` (`pages/Landing.tsx`), and two indexed copies of it would
 * compete. Removed again on leaving, so no other page inherits it.
 */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}

/**
 * The redesigned home page (2026-11-25), on a hidden address until it is
 * approved. Going live is ONE change: point `/` at this page in App.tsx.
 * Going back is `git checkout landing-classic` (tag on the commit before).
 *
 * Same single fetch as the live page: the quote strip, the latest-trades
 * strip and the record section all read one track record, so they can never
 * show two different results.
 */
export default function LandingPreview() {
  useNoIndex()
  const { data: record, loading, error } = useApiData(fetchLandingTrackRecord)

  useEffect(() => {
    AOS.init({ duration: 600, once: true, offset: 60, easing: 'ease-out-cubic' })
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-bg text-text transition-[background,color] duration-[400ms]">
      <Ticker stats={record?.stats ?? null} series={record?.series ?? []} />
      <NavNext />
      <main>
        <HeroNext />
        <RecentCloses closes={record?.recent_closes ?? []} loading={loading} error={error} />
        <SignalFlow />
        <KeyPermissions />
        <FeeExample />
        <TrackRecordNext record={record} loading={loading} error={error} />
        <GettingStarted />
      </main>
      <Footer
        maxWidth="max-w-[1200px]"
        blurb="Automated futures trading on your own Binance account. You pay only out of profit, in a month that ends at a new high."
      />
    </div>
  )
}

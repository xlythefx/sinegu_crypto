import { useEffect } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useApiData } from '../hooks/useApiData'
import { fetchLandingTrackRecord } from '../services/publicStats'
import Ticker from '../components/landing/Ticker'
import NavV2 from '../components/landing-v2/NavV2'
import HeroV2 from '../components/landing-v2/HeroV2'
import Metrics from '../components/landing-v2/Metrics'
import FeatureBento from '../components/landing-v2/FeatureBento'
import Testimonials from '../components/landing-v2/Testimonials'
import ExchangesV2 from '../components/landing-v2/ExchangesV2'
import PricingV2 from '../components/landing-v2/PricingV2'
import FaqV2 from '../components/landing-v2/FaqV2'
import FinalCtaV2 from '../components/landing-v2/FinalCtaV2'
import FooterV2 from '../components/landing-v2/FooterV2'

/**
 * Landing v2 — recreated from real 21st.dev component designs (crypto-hero,
 * feature-bento, number-ticker, testimonial grid, pricing, faq, cta, footer)
 * and adapted to this repo's stack (design tokens + AOS + lucide, no shadcn/
 * framer-motion). Lives at /v2; the original Landing (/) is untouched.
 */
export default function LandingV2() {
  // Same record the strip reads on the original landing — v2 has no
  // performance section of its own, so this is only the strip's two items.
  const { data: record } = useApiData(fetchLandingTrackRecord)

  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-bg text-text transition-[background,color] duration-[400ms]">
      <Ticker stats={record?.stats ?? null} series={record?.series ?? []} />
      <NavV2 />
      <main>
        <HeroV2 />
        <Metrics />
        <FeatureBento />
        <Testimonials />
        <ExchangesV2 />
        <PricingV2 />
        <FaqV2 />
        <FinalCtaV2 />
      </main>
      <FooterV2 />
    </div>
  )
}

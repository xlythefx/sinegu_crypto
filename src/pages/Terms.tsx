import { useEffect } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import Nav from '../components/landing/Nav'
import Footer from '../components/landing/Footer'
import LegalDocument from '../components/legal/LegalDocument'
import { TERMS } from '../lib/terms'

export default function Terms() {
  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
    document.title = `${TERMS.title} — Pixel Alpha`
    // Arriving from a footer link mid-page would otherwise keep the previous
    // scroll position; a deep link to a clause (#fees) must still land there.
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="bg-[radial-gradient(circle_at_50%_-20%,var(--glow),transparent_55%)]">
        <Nav />
        <LegalDocument doc={TERMS} />
      </div>
      <Footer />
    </div>
  )
}

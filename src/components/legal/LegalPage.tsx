import { useEffect, type ComponentType } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import Nav from '../landing/Nav'
import Footer from '../landing/Footer'
import LegalDocument from './LegalDocument'
import type { LegalDocumentContent } from '../../types/legal'

interface LegalPageProps {
  doc: LegalDocumentContent
  icon?: ComponentType<{ size?: number; className?: string }>
}

/**
 * The page shell every legal document shares: marketing nav, the glow, the
 * document, the footer. A route page is then one line — the content file
 * decides what it says, this decides where it sits.
 */
export default function LegalPage({ doc, icon }: LegalPageProps) {
  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
    document.title = `${doc.title} — Pixel Alpha`
    // Arriving from a footer link mid-page would otherwise keep the previous
    // scroll position; a deep link to a clause (#fees) must still land there.
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [doc.title])

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="bg-[radial-gradient(circle_at_50%_-20%,var(--glow),transparent_55%)]">
        <Nav />
        <LegalDocument doc={doc} icon={icon} />
      </div>
      <Footer />
    </div>
  )
}

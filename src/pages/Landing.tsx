import { useEffect } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import Ticker from '../components/landing/Ticker'
import Nav from '../components/landing/Nav'
import Hero from '../components/landing/Hero'
import Performance from '../components/landing/Performance'
import Features from '../components/landing/Features'
import HowItWorks from '../components/landing/HowItWorks'
import Exchanges from '../components/landing/Exchanges'
import FinalCta from '../components/landing/FinalCta'
import Footer from '../components/landing/Footer'

interface Bubble {
  top: number
  left?: string
  right?: string
  size: number
  blur: number
  duration: number
  delay: number
}

const BUBBLES: Bubble[] = [
  { top: 180, left: '6%', size: 90, blur: 2, duration: 9, delay: 0 },
  { top: 340, left: '22%', size: 44, blur: 1, duration: 7, delay: 1.5 },
  { top: 260, right: '10%', size: 120, blur: 3, duration: 11, delay: 0.8 },
  { top: 520, right: '26%', size: 60, blur: 2, duration: 8.5, delay: 2.2 },
  { top: 80, left: '44%', size: 34, blur: 0, duration: 6.5, delay: 3 },
]

export default function Landing() {
  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden text-text transition-[background,color] duration-[400ms] ease-[ease] bg-[linear-gradient(var(--bgScrim),var(--bgScrim)),url('/assets/hero-wallst.png')] bg-cover bg-center bg-fixed">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {BUBBLES.map((b, i) => (
          <div
            className="absolute rounded-full bg-[var(--bubble)] animate-[bubble_ease-in_infinite]"
            key={i}
            style={{
              top: b.top,
              left: b.left,
              right: b.right,
              width: b.size,
              height: b.size,
              filter: b.blur ? `blur(${b.blur}px)` : undefined,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-[1]">
        <Ticker />
        <Nav />
        <Hero />
        <Performance />
        <Features />
        {/* "We don't talk. We deliver results." (components/landing/Receipts.tsx)
            is hidden — its per-strategy ROI bars are static prototype numbers, and
            the only track record the page may publish is the verified one above.
            The component stays put; render it again to bring it back. */}
        <HowItWorks />
        <Exchanges />
        <FinalCta />
        <Footer />
      </div>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { SECTION_IDS, scrollToSection } from '../../lib/scroll'

// Bull parallax lives in index.css as `.cta-parallax` (W3Schools
// background-attachment:fixed technique) — it needs per-layer attachment/blend
// LISTS and a mobile media-query fallback, neither of which an inline style can
// express. Do NOT add filter/transform/will-change to this element or any
// ancestor: each creates a containing block that downgrades `fixed` to `scroll`
// and kills the parallax. NOTE: `data-aos` must NOT go on the <section> or any
// element wrapping the parallax layer — AOS animates via `transform`, which is
// exactly such a containing block. It lives on the inner content div instead
// (a sibling of the parallax layer), so the bull's ancestors stay transform-free.
export default function FinalCta() {
  const navigate = useNavigate()
  return (
    <section className="relative overflow-hidden mt-10">
      <div className="cta-parallax absolute inset-0 pointer-events-none" />
      <div data-aos="fade-up" className="relative max-w-[1280px] mx-auto py-[120px] px-10 text-center max-[560px]:py-20 max-[560px]:px-5">
        <div className="inline-flex items-center gap-2 font-mono text-xs text-[#d9ad55] border border-[#4a3c1c] bg-[rgba(23,19,10,0.7)] py-1.5 px-3.5 rounded-pill mb-6">
          NO CARD · NO MINIMUM · CANCEL ANYTIME
        </div>
        <h2 className="font-display text-[56px] font-extrabold tracking-[-0.03em] leading-[1.02] mb-[18px] text-white [text-shadow:0_2px_30px_rgba(0,0,0,0.6)] max-[900px]:text-[40px]">
          Take the other side
          <br />
          of the market.
        </h2>
        <p className="text-lg text-[#c3cad6] max-w-[560px] mx-auto mb-[34px] [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">
          Connect your exchange and switch on your first bot in minutes. Keep
          80% of every win — we take 20% of profit and nothing else.
        </p>
        <div className="flex gap-3.5 justify-center flex-wrap">
          <button
            className="text-base font-bold bg-[#d9ad55] text-[#0a0c11] border-none py-4 px-8 rounded-pill cursor-pointer shadow-[0_12px_30px_rgba(217,173,85,0.28)]"
            onClick={() => navigate('/auth')}
          >
            Start free with Pixel Alpha →
          </button>
          <button
            className="text-base font-bold bg-[rgba(10,12,17,0.6)] text-[#e7ecf3] border border-[#3a4450] py-4 px-[30px] rounded-pill cursor-pointer backdrop-blur-[4px]"
            onClick={() => scrollToSection(SECTION_IDS.performance)}
          >
            See live results
          </button>
        </div>
      </div>
    </section>
  )
}

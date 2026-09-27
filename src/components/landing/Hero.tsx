import { useNavigate } from 'react-router-dom'
import { useSessionUser } from '../../hooks/useSessionUser'
import { SECTION_IDS, scrollToSection } from '../../lib/scroll'
import { REGISTER_PATH } from '../../lib/routes'
import OrderBook from './OrderBook'

const CONTAINER = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

export default function Hero() {
  const navigate = useNavigate()
  const user = useSessionUser()
  return (
    <section
      className={`${CONTAINER} relative pt-16 pb-14 grid grid-cols-[1.05fr_0.95fr] gap-14 items-center max-[900px]:grid-cols-1 max-[900px]:gap-10`}
    >
      <div className="absolute top-[-40px] left-[6%] w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,var(--glow),transparent_70%)] blur-[20px] animate-[drift_14s_ease-in-out_infinite] pointer-events-none" />
      <div className="relative animate-[fadeup_0.8s_cubic-bezier(0.2,0.7,0.2,1)_both]">
        <h1 className="font-display text-[60px] leading-[1.02] font-extrabold tracking-[-0.03em] mb-[22px] max-[900px]:text-[44px] max-[560px]:text-[36px]">
          Pro-grade trading bots.
          <br />
          <span className="text-accent">Keep 80% of the upside.</span>
        </h1>
        <p className="text-lg leading-[1.6] text-muted max-w-[480px] mb-8">
          Pixel Alpha runs battle-tested strategies on{' '}
          <b className="text-text">your own</b> Binance, Bybit or MEXC account.
          Free to start — you only pay{' '}
          <b className="text-accent">20% of the profit</b> you actually make.
        </p>
        <div className="flex gap-3.5 items-center mb-7 flex-wrap">
          <button
            className="text-base font-bold bg-accent text-white border-none py-[15px] px-7 rounded-pill cursor-pointer shadow-[0_10px_26px_var(--glow)]"
            onClick={() => navigate(user ? '/dashboard' : REGISTER_PATH)}
          >
            {user ? 'Go to your account →' : 'Register →'}
          </button>
          <button
            className="text-base font-bold bg-surface text-text border border-border py-[15px] px-[26px] rounded-pill cursor-pointer"
            onClick={() => scrollToSection(SECTION_IDS.performance)}
          >
            See live results
          </button>
        </div>
        <div className="flex gap-[26px] font-mono text-xs text-faint flex-wrap">
          <span>◆ Free to use</span>
          <span>◆ Pay only 20% of profit</span>
          <span>◆ Funds stay on your exchange</span>
        </div>
      </div>
      <OrderBook />
    </section>
  )
}

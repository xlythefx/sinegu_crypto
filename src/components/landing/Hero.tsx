import { useNavigate } from 'react-router-dom'
import { useSessionUser } from '../../hooks/useSessionUser'
import { SECTION_IDS, scrollToSection } from '../../lib/scroll'
import { REGISTER_PATH } from '../../lib/routes'

const CONTAINER = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

const BIDS = [
  { price: '68,412.5', size: '0.842', depth: 62 },
  { price: '68,410.0', size: '1.204', depth: 80 },
  { price: '68,408.5', size: '0.311', depth: 28 },
  { price: '68,406.0', size: '2.087', depth: 95 },
  { price: '68,404.0', size: '0.556', depth: 44 },
]

const ASKS = [
  { price: '68,415.0', size: '0.673', depth: 50 },
  { price: '68,417.5', size: '1.548', depth: 88 },
  { price: '68,420.0', size: '0.402', depth: 36 },
  { price: '68,422.5', size: '1.910', depth: 98 },
  { price: '68,425.0', size: '0.288', depth: 24 },
]

const HISTOGRAM = [
  { height: 32, color: 'var(--green)', opacity: 0.5 },
  { height: 48, color: 'var(--green)', opacity: 0.65 },
  { height: 64, color: 'var(--green)', opacity: 0.8 },
  { height: 88, color: 'var(--green)', opacity: 1 },
  { height: 100, color: 'var(--accent)', opacity: 1 },
  { height: 92, color: 'var(--red)', opacity: 1 },
  { height: 70, color: 'var(--red)', opacity: 0.8 },
  { height: 52, color: 'var(--red)', opacity: 0.65 },
  { height: 38, color: 'var(--red)', opacity: 0.5 },
]

const ROW = 'flex justify-between py-[3px] relative'
const SIZE = 'text-muted'

function OrderBook() {
  return (
    <div className="relative bg-surface border border-border rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.18)] animate-[fadeup_0.8s_cubic-bezier(0.2,0.7,0.2,1)_0.15s_both]">
      <div className="flex items-center justify-between py-4 px-5 border-b border-hair flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-base">BTC-PERP</span>
          <span className="font-mono text-[13px] text-green">68,412.50</span>
          <span className="font-mono text-[10px] text-accent border border-accent-line bg-accent-soft py-0.5 px-2 rounded-pill">
            Z-Score Reversion #2
          </span>
        </div>
        <div className="font-mono text-[11px] text-faint flex gap-3.5">
          <span>24h Vol 1.2B</span>
          <span className="text-accent">● matching</span>
        </div>
      </div>
      <div className="grid grid-cols-2 font-mono text-xs">
        <div className="py-3.5 px-5 border-r border-hair">
          <div className="text-faint text-[10px] flex justify-between mb-2">
            <span>PRICE</span>
            <span>SIZE</span>
          </div>
          {BIDS.map((row) => (
            <div className={ROW} key={row.price}>
              <span className="text-green">{row.price}</span>
              <span className={SIZE}>{row.size}</span>
              <span
                className="absolute top-0 bottom-0 right-0 bg-[rgba(47,214,122,0.1)]"
                style={{ width: `${row.depth}%` }}
              />
            </div>
          ))}
        </div>
        <div className="py-3.5 px-5">
          <div className="text-faint text-[10px] flex justify-between mb-2">
            <span>PRICE</span>
            <span>SIZE</span>
          </div>
          {ASKS.map((row) => (
            <div className={ROW} key={row.price}>
              <span className="text-red">{row.price}</span>
              <span className={SIZE}>{row.size}</span>
              <span
                className="absolute top-0 bottom-0 left-0 bg-[rgba(255,90,90,0.1)]"
                style={{ width: `${row.depth}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-hair py-4 px-5">
        <div className="flex items-end gap-1 h-[74px]">
          {HISTOGRAM.map((bar, i) => (
            <div
              className="flex-1 rounded-t-[4px]"
              key={i}
              style={{
                height: `${bar.height}%`,
                background: bar.color,
                opacity: bar.opacity,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between font-mono text-[10px] text-faint mt-2">
          <span>−0.5% depth</span>
          <span>MID 68,413.75</span>
          <span>+0.5% depth</span>
        </div>
      </div>
    </div>
  )
}

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

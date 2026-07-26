import { useNavigate } from 'react-router-dom'

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

function OrderBook() {
  return (
    <div className="orderbook">
      <div className="orderbook__header">
        <div className="orderbook__title">
          <span className="orderbook__pair">BTC-PERP</span>
          <span className="orderbook__price">68,412.50</span>
          <span className="orderbook__strategy">Z-Score Reversion #2</span>
        </div>
        <div className="orderbook__meta">
          <span>24h Vol 1.2B</span>
          <span className="accent">● matching</span>
        </div>
      </div>
      <div className="orderbook__ladder">
        <div className="orderbook__col orderbook__col--bids">
          <div className="orderbook__col-head">
            <span>PRICE</span>
            <span>SIZE</span>
          </div>
          {BIDS.map((row) => (
            <div className="orderbook__row" key={row.price}>
              <span className="orderbook__row-price--bid">{row.price}</span>
              <span className="orderbook__row-size">{row.size}</span>
              <span
                className="orderbook__depth orderbook__depth--bid"
                style={{ width: `${row.depth}%` }}
              />
            </div>
          ))}
        </div>
        <div className="orderbook__col">
          <div className="orderbook__col-head">
            <span>PRICE</span>
            <span>SIZE</span>
          </div>
          {ASKS.map((row) => (
            <div className="orderbook__row" key={row.price}>
              <span className="orderbook__row-price--ask">{row.price}</span>
              <span className="orderbook__row-size">{row.size}</span>
              <span
                className="orderbook__depth orderbook__depth--ask"
                style={{ width: `${row.depth}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="orderbook__footer">
        <div className="orderbook__histogram">
          {HISTOGRAM.map((bar, i) => (
            <div
              className="orderbook__bar"
              key={i}
              style={{
                height: `${bar.height}%`,
                background: bar.color,
                opacity: bar.opacity,
              }}
            />
          ))}
        </div>
        <div className="orderbook__depth-labels">
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
  return (
    <section className="hero container">
      <div className="hero__glow" />
      <div className="hero__copy">
        <div className="hero__badge">
          <span className="hero__badge-dot" />
          48,200+ traders copying live signals right now
        </div>
        <h1 className="hero__title">
          Pro-grade trading bots.
          <br />
          <span className="hero__title-accent">Keep 80% of the upside.</span>
        </h1>
        <p className="hero__sub">
          SineguAlerts runs battle-tested strategies on <b>your own</b>{' '}
          Binance, Bybit or MEXC account. Free to start — you only pay{' '}
          <b className="accent">20% of the profit</b> you actually make.
        </p>
        <div className="hero__actions">
          <button
            className="btn-hero-primary"
            onClick={() => navigate('/auth')}
          >
            Start free →
          </button>
          <button className="btn-hero-outline">See live results</button>
        </div>
        <div className="hero__trust">
          <span>◆ Free to use</span>
          <span>◆ Pay only 20% of profit</span>
          <span>◆ Funds stay on your exchange</span>
        </div>
      </div>
      <OrderBook />
    </section>
  )
}

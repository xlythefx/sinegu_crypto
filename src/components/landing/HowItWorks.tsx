const STEPS = [
  {
    num: '01',
    title: 'Connect your exchange',
    body: 'Link Binance, Bybit or MEXC with trade-only API keys. Withdrawals stay disabled.',
  },
  {
    num: '02',
    title: 'Pick a strategy',
    body: 'Choose a strategy, set your risk level, and press go.',
  },
  {
    num: '03',
    title: 'Bots trade for you',
    body: 'Signals execute automatically on your account, 24/7 — no screen time required.',
  },
  {
    num: '04',
    title: 'Keep 80%',
    body: 'Withdraw anytime. We deduct 20% only from profit — never your capital.',
    highlight: true,
  },
]

export default function HowItWorks() {
  return (
    <section data-aos="fade-up" className="section container">
        <h2 className="steps-title">Profitable in four steps</h2>
        <div className="steps-grid">
          {STEPS.map((s) => (
            <div
              className={`step-card${s.highlight ? ' step-card--highlight' : ''}`}
              key={s.num}
            >
              <div className="step-card__num">{s.num}</div>
              <h3 className="step-card__title">{s.title}</h3>
              <p className="step-card__body">{s.body}</p>
            </div>
          ))}
        </div>
    </section>
  )
}

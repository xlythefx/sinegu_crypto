const FEATURES = [
  {
    icon: '⊞',
    title: 'Proven strategies',
    body: 'Battle-tested bots with transparent, verifiable track records — not black boxes.',
  },
  {
    icon: '↻',
    title: 'Trades 24/7',
    body: 'Signals execute automatically on your account around the clock — no screen time needed.',
  },
  {
    icon: '⛨',
    title: 'Your funds, your keys',
    body: 'Trade-only API keys, withdrawals disabled. Money never leaves your exchange.',
  },
  {
    icon: '%',
    title: 'Aligned pricing',
    body: 'We take 20% of profit and nothing else. No profit, no fee — ever.',
  },
]

export default function Features() {
  return (
    <section data-aos="fade-up" className="section container">
        <div className="section__head" style={{ marginBottom: 40 }}>
          <h2 className="section__title">Built to trade for you</h2>
          <p className="section__sub" style={{ maxWidth: 520 }}>
            Institutional-grade execution, wrapped in something you'll actually
            enjoy using.
          </p>
        </div>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-card__icon">{f.icon}</div>
              <h3 className="feature-card__title">{f.title}</h3>
              <p className="feature-card__body">{f.body}</p>
            </div>
          ))}
        </div>
    </section>
  )
}

const EXCHANGES = ['Binance', 'Bybit', 'MEXC']

const TESTIMONIALS = [
  {
    quote:
      '"Turned on Z-Score Reversion on my Bybit account and did nothing else. Up +38% in three months and I only paid on the days I won."',
    author: '— Marcus T., ',
    tag: '6 months in',
  },
  {
    quote:
      '"The 20%-of-profit model sold me — zero risk to try. My funds never left Binance and the bots just kept compounding."',
    author: '— Elena R., ',
    tag: 'was a total beginner',
  },
]

export default function Exchanges() {
  return (
    <section data-aos="fade-up" className="section container">
        <p className="exchanges__caption">
          WORKS DIRECTLY WITH YOUR EXCHANGE — YOUR FUNDS NEVER LEAVE IT
        </p>
        <div className="exchanges-grid">
          {EXCHANGES.map((name) => (
            <div className="exchange-card" key={name}>
              <div className="exchange-card__name">{name}</div>
              <div className="exchange-card__sub">Spot &amp; Futures API</div>
            </div>
          ))}
        </div>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((t) => (
            <div className="testimonial-card" key={t.tag}>
              <div className="testimonial-card__stars">★★★★★</div>
              <p className="testimonial-card__quote">{t.quote}</p>
              <div className="testimonial-card__author">
                {t.author}
                <span className="accent">{t.tag}</span>
              </div>
            </div>
          ))}
        </div>
    </section>
  )
}

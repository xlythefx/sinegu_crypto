const CONTAINER = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

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
    <section
      data-aos="fade-up"
      className={`${CONTAINER} pt-[52px] pb-[76px]`}
    >
      <p className="font-mono text-xs text-faint text-center mb-7">
        WORKS DIRECTLY WITH YOUR EXCHANGE — YOUR FUNDS NEVER LEAVE IT
      </p>
      <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        {EXCHANGES.map((name) => (
          <div
            className="border border-accent-line rounded-[18px] py-[30px] px-[22px] text-center bg-surface"
            key={name}
          >
            <div className="font-display font-extrabold text-[22px]">
              {name}
            </div>
            <div className="font-mono text-[11px] text-faint mt-1.5">
              Spot &amp; Futures API
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4 max-[900px]:grid-cols-1">
        {TESTIMONIALS.map((t) => (
          <div
            className="bg-surface border border-border rounded-[18px] p-7"
            key={t.tag}
          >
            <div className="text-accent text-[15px] mb-3">★★★★★</div>
            <p className="text-base leading-[1.6] font-medium mb-[18px]">
              {t.quote}
            </p>
            <div className="font-mono text-xs text-muted">
              {t.author}
              <span className="text-accent">{t.tag}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

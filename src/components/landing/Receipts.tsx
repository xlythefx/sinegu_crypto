const BARS = [
  { name: 'Z-Score Reversion #2', value: '+11.4%', height: 74, highlight: false },
  { name: 'ATR Reversion #1', value: '+9.8%', height: 62, highlight: false },
  { name: 'Momentum Strategy', value: '+8.6%', height: 55, highlight: false },
  { name: 'SineguAlerts blended', value: '+12.9%', height: 96, highlight: true },
]

export default function Receipts() {
  return (
    <section data-aos="fade-up" className="section container">
      <div className="receipts__head">
        <span className="receipts__kicker">[ THE RECEIPTS ]</span>
        <h2 className="receipts__title">We don't talk. We deliver results.</h2>
        <p className="receipts__sub">
          Average monthly ROI for each of our automated strategies over the
          last 90 days — and the blended return across all of them.
        </p>
      </div>
      <div className="receipts__bars">
        {BARS.map((bar) => (
          <div
            className="rbar"
            key={bar.name}
            data-aos="fade-up"
            data-aos-delay={bar.highlight ? 300 : 0}
          >
            <div className="rbar__track">
              <div
                className={`rbar__fill${bar.highlight ? ' rbar__fill--accent' : ''}`}
                style={{
                  height: `${bar.height}%`,
                  animationDelay: bar.highlight ? '0.5s' : '0.2s',
                }}
              >
                <div
                  className={`rbar__value${bar.highlight ? ' rbar__value--onAccent' : ''}`}
                >
                  {bar.value}
                </div>
              </div>
              {bar.highlight && (
                <div className="rbar__tooltip">blended, 90d</div>
              )}
            </div>
            <div className="rbar__label">
              {bar.highlight ? (
                <span className="rbar__logo" />
              ) : (
                <span className="rbar__dot" />
              )}
              <span
                className={`rbar__name${bar.highlight ? ' rbar__name--highlight' : ''}`}
              >
                {bar.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

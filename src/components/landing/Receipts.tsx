const CONTAINER = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

const BARS = [
  { name: 'Z-Score Reversion #2', value: '+11.4%', height: 74, highlight: false },
  { name: 'ATR Reversion #1', value: '+9.8%', height: 62, highlight: false },
  { name: 'Momentum Strategy', value: '+8.6%', height: 55, highlight: false },
  { name: 'SineguAlerts blended', value: '+12.9%', height: 96, highlight: true },
]

export default function Receipts() {
  return (
    <section
      data-aos="fade-up"
      className={`${CONTAINER} pt-[52px] pb-[76px]`}
    >
      <div className="max-w-[660px] mx-auto text-center">
        <span className="font-mono text-xs tracking-[0.14em] text-accent">
          [ THE RECEIPTS ]
        </span>
        <h2 className="font-display text-[40px] font-extrabold tracking-[-0.02em] leading-[1.05] mt-[14px] mb-3">
          We don't talk. We deliver results.
        </h2>
        <p className="text-[17px] text-muted leading-[1.55]">
          Average monthly ROI for each of our automated strategies over the
          last 90 days — and the blended return across all of them.
        </p>
      </div>
      <div className="relative max-w-[900px] mx-auto mt-[52px] flex items-stretch justify-center gap-4 h-[440px] max-[900px]:flex-wrap max-[900px]:h-auto">
        {BARS.map((bar) => (
          <div
            className="flex flex-col items-center gap-3.5 flex-1 h-full max-[900px]:flex-[1_1_40%] max-[900px]:h-[320px] max-[560px]:flex-[1_1_100%] max-[560px]:h-[280px]"
            key={bar.name}
            data-aos="fade-up"
            data-aos-delay={bar.highlight ? 300 : 0}
          >
            <div className="relative flex-1 w-full rounded-[28px] overflow-hidden bg-surface2 bg-[linear-gradient(135deg,var(--hair)_25%,transparent_25.5%,transparent_50%,var(--hair)_50.5%,var(--hair)_75%,transparent_75.5%,transparent)] bg-[length:12px_12px] border border-border flex items-end">
              <div
                className={`w-full origin-bottom animate-[grow_0.9s_cubic-bezier(0.2,0.8,0.2,1)_both] rounded-[24px] p-3 flex items-start justify-center ${
                  bar.highlight ? 'bg-accent' : 'bg-muted'
                }`}
                style={{
                  height: `${bar.height}%`,
                  animationDelay: bar.highlight ? '0.5s' : '0.2s',
                }}
              >
                <div
                  className={`w-full py-3 rounded-pill bg-[rgba(255,255,255,0.16)] text-center font-mono font-semibold text-[17px] ${
                    bar.highlight ? 'text-on-accent' : 'text-white'
                  }`}
                >
                  {bar.value}
                </div>
              </div>
              {bar.highlight && (
                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 bg-text text-bg font-mono text-[11px] py-[5px] px-2.5 rounded-btn whitespace-nowrap">
                  blended, 90d
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-center">
              {bar.highlight ? (
                <span className="w-[18px] h-[18px] bg-accent rounded-[6px_6px_6px_2px] -rotate-[8deg] block shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-accent block shrink-0" />
              )}
              <span
                className={`text-[13.5px] font-semibold ${
                  bar.highlight ? 'text-text' : 'text-muted'
                }`}
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

const CONTAINER = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'
const SECTION_TITLE =
  'font-display text-[38px] font-extrabold tracking-[-0.02em] mb-2.5'
const SECTION_SUB = 'text-[17px] text-muted max-w-[560px] mx-auto'

const STATS = [
  { label: 'Total P&L', value: '+42.9%', tone: 'green', hint: 'Total PNL %' },
  { label: 'Win Rate', value: '71.3%', tone: 'accent', hint: 'Winning days' },
  { label: 'Total Trades', value: '4,182', tone: '', hint: 'Executed trades' },
  {
    label: 'Avg Daily P&L',
    value: '+0.34%',
    tone: 'green',
    hint: 'Per trading day',
  },
  {
    label: 'Avg Win PNL',
    value: '+3.50%',
    tone: 'green',
    hint: 'Per winning day',
  },
  {
    label: 'Avg Loss PNL',
    value: '−1.64%',
    tone: 'red',
    hint: 'Per losing day',
  },
]

const TONE: Record<string, string> = {
  green: 'text-green',
  accent: 'text-accent',
  red: 'text-red',
}

const LINE_PATH =
  'M48,211.3 L73.7,215.4 L99.3,206.4 L125,217.1 L150.7,207.2 L176.4,219.5 L202,199.8 L227.7,209.6 L253.4,194.8 L279.1,203.1 L304.7,188.2 L330.4,197.3 L356.1,183.3 L381.8,191.5 L407.4,170.1 L433.1,180 L458.8,160.2 L484.5,171.8 L510.1,145.4 L535.8,156.9 L561.5,127.3 L587.2,138.8 L612.8,105.9 L638.5,120.7 L664.2,87.8 L689.9,99.3 L715.5,68 L741.2,82.8 L766.9,46.6 L792.6,59.8 L818.2,40 L843.9,56.5 L869.6,71.3 L895.3,87.8 L920.9,97.6 L946.6,77.9 L972.3,87.8 L998,64.7 L1023.6,76.2 L1049.3,54.8 L1075,65.5 L1100.7,47.4 L1126.3,58.1 L1152,49.9'

const DATES = [
  'Oct 13',
  'Oct 29',
  'Nov 12',
  'Nov 28',
  'Dec 12',
  'Dec 29',
  'Jan 15',
  'Feb 2',
  'Feb 20',
  'Mar 9',
  'Mar 27',
  'Apr 14',
  'May 2',
  'May 20',
  'Jun 7',
  'Jun 24',
  'Jul 12',
]

export default function Performance() {
  return (
    <section
      data-aos="fade-up"
      className={`${CONTAINER} pt-[60px] pb-[76px]`}
    >
      <div className="text-center mb-9">
        <h2 className={SECTION_TITLE}>See every trade, verified</h2>
        <p className={SECTION_SUB}>
          Full, real-time performance analytics for every strategy — the same
          numbers we're paid on.
        </p>
      </div>
      <div className="grid grid-cols-6 gap-3.5 mb-5 max-[1100px]:grid-cols-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        {STATS.map((s) => (
          <div
            className="bg-surface border border-border rounded-card p-card"
            key={s.label}
          >
            <div className="text-xs text-muted font-semibold mb-3">
              {s.label}
            </div>
            <div
              className={`font-display text-[26px] font-extrabold${s.tone ? ` ${TONE[s.tone]}` : ''}`}
            >
              {s.value}
            </div>
            <div className="text-[11px] text-faint mt-1">{s.hint}</div>
          </div>
        ))}
      </div>
      <div className="bg-surface border border-border rounded-[22px] pt-7 px-[30px] pb-6 shadow-[0_30px_80px_rgba(0,0,0,0.14)]">
        <div className="flex items-start justify-between mb-[22px] flex-wrap gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-[42px] h-[42px] rounded-xl bg-accent-soft border border-accent-line flex items-center justify-center text-accent text-xl">
              ↗
            </div>
            <div>
              <div className="font-display text-[22px] font-extrabold">
                Performance Analytics
              </div>
              <div className="text-[13px] text-muted mt-0.5">
                Real-time profit and loss tracking with advanced charting tools
              </div>
            </div>
          </div>
          <div className="w-[34px] h-[34px] border border-border rounded-[10px] flex items-center justify-center text-muted cursor-pointer">
            ⋮
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-surface2 border border-hair rounded-xl p-[5px] mb-6">
          <button className="text-center py-[11px] rounded-btn text-sm bg-surface border border-border font-bold text-text cursor-pointer">
            Cumulative P&L
          </button>
          <button className="text-center py-[11px] rounded-btn text-sm font-semibold text-muted cursor-pointer border border-transparent bg-transparent">
            Daily P&L
          </button>
          <button className="text-center py-[11px] rounded-btn text-sm font-semibold text-muted cursor-pointer border border-transparent bg-transparent">
            Date Range
          </button>
        </div>
        <div className="flex gap-3.5">
          <div className="flex flex-col justify-between font-mono text-[11px] text-faint text-right pt-1 pb-[22px] w-16 shrink-0">
            <span>$3,050.00</span>
            <span>$2,483.33</span>
            <span>$1,916.67</span>
            <span>$1,350.00</span>
          </div>
          <div className="flex-1 min-w-0">
            <svg
              viewBox="0 0 1200 360"
              preserveAspectRatio="none"
              className="w-full h-[340px] block"
            >
              <defs>
                <linearGradient id="paFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d9ad55" stopOpacity=".38" />
                  <stop offset="100%" stopColor="#d9ad55" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g stroke="var(--hair)" strokeWidth="1">
                <line x1="48" y1="40" x2="1152" y2="40" />
                <line x1="48" y1="133" x2="1152" y2="133" />
                <line x1="48" y1="227" x2="1152" y2="227" />
                <line x1="48" y1="320" x2="1152" y2="320" />
              </g>
              <line
                x1="48"
                y1="212.9"
                x2="1152"
                y2="212.9"
                stroke="var(--muted)"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity=".7"
              />
              <path
                d={`${LINE_PATH} L1152,340 L48,340 Z`}
                fill="url(#paFill)"
              />
              <path
                d={LINE_PATH}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1000}
                strokeDasharray="1000"
                strokeDashoffset="1000"
                className="animate-[draw_2.6s_ease_0.2s_forwards]"
              />
              <circle
                cx="1152"
                cy="49.9"
                r="5"
                fill="var(--accent)"
                opacity="0"
                className="animate-[fadeup_0.4s_ease_2.6s_forwards]"
              />
              <text
                x="56"
                y="204.9"
                fontFamily="'IBM Plex Mono',monospace"
                fontSize="12"
                fill="var(--muted)"
              >
                Deposit Amount
              </text>
            </svg>
            <div className="flex font-mono text-[10.5px] text-faint mt-1.5">
              {DATES.map((d) => (
                <span
                  key={d}
                  className="flex-1 text-center max-[900px]:[&:nth-child(2n)]:hidden"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

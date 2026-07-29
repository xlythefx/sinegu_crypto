const CONTAINER = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

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
    <section
      data-aos="fade-up"
      className={`${CONTAINER} pt-[52px] pb-[76px]`}
    >
      <div className="text-center mb-10">
        <h2 className="font-display text-[38px] font-extrabold tracking-[-0.02em] mb-2.5">
          Built to trade for you
        </h2>
        <p className="text-[17px] text-muted max-w-[520px] mx-auto">
          Institutional-grade execution, wrapped in something you'll actually
          enjoy using.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-[18px] max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1">
        {FEATURES.map((f) => (
          <div
            className="bg-surface border border-border rounded-[20px] p-[26px]"
            key={f.title}
          >
            <div className="w-12 h-12 rounded-[14px] bg-accent-soft border border-accent-line flex items-center justify-center text-accent font-mono text-xl mb-[18px]">
              {f.icon}
            </div>
            <h3 className="font-display text-lg font-bold mb-2">{f.title}</h3>
            <p className="text-[13.5px] leading-[1.6] text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

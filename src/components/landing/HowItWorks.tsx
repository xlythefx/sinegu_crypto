const CONTAINER = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

const STEPS = [
  {
    num: '01',
    title: 'Connect your exchange',
    body: 'Link your Binance account with a trade-only API key. Withdrawals stay disabled. Bybit and MEXC are coming soon.',
  },
  {
    num: '02',
    title: 'Bots trade for you',
    body: 'Signals execute automatically on your account, 24/7 — no screen time required.',
  },
  {
    num: '03',
    title: 'Stop anytime with 1 click',
    body: 'Pause the bots whenever you want. No lock-in, no notice period.',
  },
  {
    num: '04',
    title: 'Keep 80%',
    body: 'Withdraw anytime. You pay 20% only from profit — never from capital.',
    highlight: true,
  },
]

export default function HowItWorks() {
  return (
    <section
      data-aos="fade-up"
      className={`${CONTAINER} pt-[52px] pb-[76px]`}
    >
      <h2 className="font-display text-[38px] font-extrabold tracking-[-0.02em] text-center mb-10">
        Profitable in four steps
      </h2>
      <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1">
        {STEPS.map((s) => (
          <div
            className={`rounded-[20px] py-7 px-6 ${
              s.highlight
                ? 'bg-[linear-gradient(135deg,var(--accentSoft),var(--surface))] border border-accent-line'
                : 'bg-surface border border-border'
            }`}
            key={s.num}
          >
            <div className="font-mono text-[32px] text-accent font-semibold mb-4">
              {s.num}
            </div>
            <h3 className="font-display text-[17px] font-bold mb-2">
              {s.title}
            </h3>
            <p className="text-[13.5px] leading-[1.6] text-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const QUOTES = [
  { label: 'BTC/USD', value: '68,412.50', delta: '+1.84%', dir: 'up' },
  { label: 'ETH/USD', value: '3,571.20', delta: '-0.42%', dir: 'down' },
  { label: 'SOL/USD', value: '184.06', delta: '+5.11%', dir: 'up' },
  { label: 'SINEGU USERS', value: '48.2K', delta: '+2.3%', dir: 'up' },
  { label: 'AVG ROI', value: '11.4%', delta: '30d', dir: 'up' },
  { label: 'FUNDING', value: '0.0093%', delta: '8h', dir: 'accent' },
] as const

const DELTA_TONE: Record<string, string> = {
  up: 'text-green',
  down: 'text-red',
  accent: 'text-accent',
}

export default function Ticker() {
  // Row duplicated once and translated -50% for a seamless infinite loop
  const row = [...QUOTES, ...QUOTES]
  return (
    <div className="border-b border-hair bg-surface2 overflow-hidden whitespace-nowrap">
      <div className="inline-flex gap-9 py-[9px] font-mono text-[12.5px] animate-[tick_42s_linear_infinite] will-change-transform">
        {row.map((q, i) => (
          <span className="text-faint" key={i}>
            {q.label} <b className="text-text font-medium">{q.value}</b>{' '}
            <span className={DELTA_TONE[q.dir]}>{q.delta}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

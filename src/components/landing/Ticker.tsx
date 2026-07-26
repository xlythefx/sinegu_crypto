const QUOTES = [
  { label: 'BTC/USD', value: '68,412.50', delta: '+1.84%', dir: 'up' },
  { label: 'ETH/USD', value: '3,571.20', delta: '-0.42%', dir: 'down' },
  { label: 'SOL/USD', value: '184.06', delta: '+5.11%', dir: 'up' },
  { label: 'SINEGU USERS', value: '48.2K', delta: '+2.3%', dir: 'up' },
  { label: 'AVG ROI', value: '11.4%', delta: '30d', dir: 'up' },
  { label: 'FUNDING', value: '0.0093%', delta: '8h', dir: 'accent' },
] as const

export default function Ticker() {
  // Row duplicated once and translated -50% for a seamless infinite loop
  const row = [...QUOTES, ...QUOTES]
  return (
    <div className="ticker">
      <div className="ticker__track">
        {row.map((q, i) => (
          <span className="ticker__item" key={i}>
            {q.label} <b>{q.value}</b>{' '}
            <span
              className={
                q.dir === 'up'
                  ? 'ticker__up'
                  : q.dir === 'down'
                    ? 'ticker__down'
                    : 'ticker__accent'
              }
            >
              {q.delta}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

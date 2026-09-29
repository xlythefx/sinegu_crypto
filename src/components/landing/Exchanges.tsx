import { plainStats } from '../../lib/trackRecord'
import type { TrackRecordStats } from '../../types/publicStats'

const CONTAINER = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

/** Binance is the one venue customers can connect; the other two are on the
 *  way (staff-only in the app — see `staffOnly` in exchanges/meta.ts). */
const EXCHANGES = [
  { name: 'Binance', live: true },
  { name: 'Bybit', live: false },
  { name: 'MEXC', live: false },
]

interface ExchangesProps {
  /** The page's one track-record fetch — the same figures as Performance. */
  stats: TrackRecordStats | null
}

export default function Exchanges({ stats }: ExchangesProps) {
  const facts = plainStats(stats)
  return (
    <section
      data-aos="fade-up"
      className={`${CONTAINER} pt-[52px] pb-[76px]`}
    >
      <p className="font-mono text-xs text-faint text-center mb-7">
        WORKS DIRECTLY WITH YOUR EXCHANGE — YOUR FUNDS NEVER LEAVE IT
      </p>
      <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-1">
        {EXCHANGES.map(({ name, live }) => (
          <div
            className={`rounded-[18px] py-[30px] px-[22px] text-center bg-surface border ${
              live ? 'border-accent-line' : 'border-border opacity-60'
            }`}
            key={name}
          >
            <div className="font-display font-extrabold text-[22px]">
              {name}
            </div>
            <div
              className={`font-mono text-[11px] mt-1.5 ${live ? 'text-accent' : 'text-faint'}`}
            >
              {live ? 'Live now · Futures' : 'Coming soon'}
            </div>
          </div>
        ))}
      </div>
      {facts.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mt-4 max-[900px]:grid-cols-1">
            {facts.map((f) => (
              <div
                className="bg-surface border border-border rounded-[18px] p-7 text-center"
                key={f.text}
              >
                <div className="font-display text-[28px] font-extrabold text-accent">
                  {f.value}
                </div>
                <p className="text-[14px] leading-[1.5] text-muted mt-2">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-faint mt-4 text-center">
            From our live master account on Binance — the same record as the
            chart above.
          </p>
        </>
      )}
    </section>
  )
}

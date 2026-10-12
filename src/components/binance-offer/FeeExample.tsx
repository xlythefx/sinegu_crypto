import { fmtMoney } from '../../lib/format'
import {
  EXAMPLE_PROFIT,
  OFFER_FEE_PCT,
  STANDARD_FEE_PCT,
  feeAt,
} from '../../lib/binanceOffer'

const ROW = 'flex items-baseline justify-between gap-4 py-3'

/**
 * One month, worked by hand: the same profit billed at both rates. Round
 * figures on purpose — a reader should be able to check every line in their
 * head, which is the whole argument the card makes.
 */
export default function FeeExample() {
  const standard = feeAt(EXAMPLE_PROFIT, STANDARD_FEE_PCT)
  const offer = feeAt(EXAMPLE_PROFIT, OFFER_FEE_PCT)
  const saved = standard - offer

  return (
    <div className="rounded-card border border-accent-line bg-[linear-gradient(135deg,var(--accentSoft),var(--surface))] p-7 max-[560px]:p-5">
      <div className="font-mono text-[11px] uppercase tracking-widest text-faint">
        Example month
      </div>

      <div className={`${ROW} mt-2 border-b border-hair`}>
        <span className="text-[14.5px] text-muted">Profit on closed trades</span>
        <span className="font-mono text-[17px] font-bold text-text">
          {fmtMoney(EXAMPLE_PROFIT, 0)}
        </span>
      </div>
      <div className={`${ROW} border-b border-hair`}>
        <span className="text-[14.5px] text-muted">Standard fee · {STANDARD_FEE_PCT}%</span>
        <span className="font-mono text-[17px] text-faint line-through">
          {fmtMoney(standard, 0)}
        </span>
      </div>
      <div className={ROW}>
        <span className="text-[14.5px] font-semibold text-text">
          With the Binance offer · {OFFER_FEE_PCT}%
        </span>
        <span className="font-mono text-[22px] font-bold text-accent">{fmtMoney(offer, 0)}</span>
      </div>

      <div className="mt-4 rounded-field bg-surface2 px-4 py-3.5 text-[14.5px] leading-[1.6] text-muted">
        You keep{' '}
        <strong className="font-bold text-green">{fmtMoney(EXAMPLE_PROFIT - offer, 0)}</strong>{' '}
        instead of {fmtMoney(EXAMPLE_PROFIT - standard, 0)} —{' '}
        <strong className="font-bold text-text">{fmtMoney(saved, 0)} more</strong>, every month
        like this one.
      </div>
    </div>
  )
}

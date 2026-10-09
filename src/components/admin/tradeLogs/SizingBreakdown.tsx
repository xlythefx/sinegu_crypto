import { fmtMoney, fmtQty } from '../../../lib/format'
import type { SizingDecision } from '../../../types/tradeLogs'

/**
 * The engine's sizing arithmetic for one account, shown as the formula it
 * actually ran — balance ÷ reference → multiple × base size = quantity — so a
 * position size can be explained without replaying the account's balance.
 */
export default function SizingBreakdown({
  sizing,
  ticker,
}: {
  sizing: SizingDecision
  ticker: string
}) {
  const {
    balance,
    totalDeposit,
    minDeposit,
    baseSize,
    referenceBalance,
    coarseStep,
    quantity,
    sizeMultiple,
    stacksNow,
    maxIncrements,
    lossStreak,
    streakKnown,
    streakStep,
    streakSize,
  } = sizing

  const belowReference =
    balance !== null && referenceBalance !== null && balance < referenceBalance
  // Loss-streak sizing swaps the size the multiple applies to; base size is
  // still the asset's own figure. Null on assets without a ladder.
  const hasStreak = lossStreak !== null
  const sizeUsed = hasStreak && streakSize !== null ? streakSize : baseSize

  // A deposit-gated skip never got as far as sizing, so there is no formula to
  // show — only why the account was refused.
  if (baseSize === null) {
    return (
      <div className="rounded-[11px] border border-hair bg-surface2 p-3.5">
        <span className="block text-[10px] uppercase tracking-[0.07em] text-faint font-semibold mb-2.5">
          Deposit gate
        </span>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5 max-[560px]:grid-cols-2">
          <Field
            label="Total deposited"
            value={totalDeposit !== null ? fmtMoney(totalDeposit) : 'Unknown'}
            strong
          />
          <Field
            label="Minimum required"
            value={minDeposit !== null ? fmtMoney(minDeposit) : '—'}
          />
          <Field label="Balance" value={balance !== null ? fmtMoney(balance) : '—'} />
        </dl>
        <p className="text-[11.5px] text-muted mt-2.5 leading-snug">
          {totalDeposit === null
            ? 'No deposit figure has been synced for this account yet, so entries are refused. Exits are still allowed.'
            : 'Entries need deposited capital at or above the minimum. The gate reads deposits, not balance — a drawdown alone never blocks an account.'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[11px] border border-hair bg-surface2 p-3.5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
        <span className="text-[10px] uppercase tracking-[0.07em] text-faint font-semibold">
          Sizing decision
        </span>
        <span className="text-[10px] uppercase tracking-[0.05em] text-faint font-semibold px-2 py-[2px] rounded-pill border border-hair">
          {coarseStep ? 'Whole steps' : 'Tenth steps'}
        </span>
      </div>

      {/* The formula, as one readable line. */}
      <p className="font-mono text-[12.5px] text-text leading-relaxed mb-3 break-words">
        {balance !== null ? fmtMoney(balance) : '—'}
        <span className="text-faint"> ÷ </span>
        {referenceBalance !== null ? fmtMoney(referenceBalance) : '—'}
        <span className="text-faint"> → </span>
        <span className="text-accent font-semibold">
          ×{sizeMultiple !== null ? fmtQty(sizeMultiple, 0, 4) : '—'}
        </span>
        <span className="text-faint"> × </span>
        {sizeUsed !== null ? fmtQty(sizeUsed, 0, 8) : '—'}
        <span className="text-faint"> = </span>
        <span className="text-text font-semibold">
          {quantity !== null ? fmtQty(quantity, 0, 8) : '—'} {ticker.replace(/USDT$/, '')}
        </span>
      </p>

      {hasStreak && (
        <p className="text-[11.5px] text-muted mb-3 leading-snug">
          {streakKnown === false
            ? 'Loss-streak sizing: the trade history could not be read, so base size was used.'
            : streakStep
              ? `Loss-streak sizing: ${lossStreak} loss${lossStreak === 1 ? '' : 'es'} in a row, so the ${streakStep}-loss size (${fmtQty(sizeUsed ?? 0, 0, 8)}) was used instead of base ${fmtQty(baseSize, 0, 8)}.`
              : lossStreak
                ? `Loss-streak sizing: ${lossStreak} loss${lossStreak === 1 ? '' : 'es'} in a row, below the first step, so base size was used.`
                : 'Loss-streak sizing: no losing streak, so base size was used.'}
        </p>
      )}

      {belowReference && (
        <p className="text-[11.5px] text-muted mb-3 leading-snug">
          Balance is below the {referenceBalance !== null ? fmtMoney(referenceBalance) : ''}{' '}
          reference, so this account gets exactly one base size.
        </p>
      )}

      <dl className="grid grid-cols-4 gap-x-3 gap-y-2.5 max-[560px]:grid-cols-2">
        <Field label="Balance" value={balance !== null ? fmtMoney(balance) : '—'} />
        <Field
          label="Deposited"
          value={totalDeposit !== null ? fmtMoney(totalDeposit) : '—'}
        />
        <Field label="Base size" value={baseSize !== null ? fmtQty(baseSize, 0, 8) : '—'} />
        <Field
          label="Multiple"
          value={sizeMultiple !== null ? `×${fmtQty(sizeMultiple, 0, 4)}` : '—'}
        />
        <Field
          label="Quantity"
          value={quantity !== null ? fmtQty(quantity, 0, 8) : '—'}
          strong
        />
        <Field
          label="Stack used"
          value={
            maxIncrements && maxIncrements > 0
              ? `${stacksNow !== null ? fmtQty(stacksNow, 0, 2) : '0'} / ${fmtQty(maxIncrements, 0, 2)}`
              : 'Uncapped'
          }
        />
      </dl>
    </div>
  )
}

function Field({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.06em] text-faint mb-[3px]">
        {label}
      </dt>
      <dd
        className={`font-mono text-[12.5px] ${strong ? 'text-text font-semibold' : 'text-muted'}`}
      >
        {value}
      </dd>
    </div>
  )
}

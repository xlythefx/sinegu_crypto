import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Sigma, TrendingUp, X } from 'lucide-react'
import {
  fmtMediumDate,
  fmtMoney,
  fmtShortDate,
  fmtSignedMoney,
  fmtSignedPct,
} from '../../lib/format'
import { useTween } from '../../hooks/useTween'
import Sheen from '../ui/Sheen'
import type { PeriodReturn } from '../../lib/periodReturn'

interface PeriodReturnModalProps {
  open: boolean
  onClose: () => void
  from: string
  to: string
  result: PeriodReturn
  /** A ticker/strategy chip is active — the days are the filtered trades. */
  filtered: boolean
}

/**
 * The Period Return, opened up: the ADDED figure the card shows beside the
 * COMPOUNDED one, and the day-by-day list both are built from. One set of
 * daily percentages, two methods — so a reader comparing the card with the
 * landing page or a monthly recap (which compound) can see exactly why they
 * differ, and by how much.
 *
 * Portalled into <body> because the card animates in with AOS (`transform`),
 * which would trap a fixed overlay inside it.
 */
export default function PeriodReturnModal(props: PeriodReturnModalProps) {
  if (!props.open) return null
  // A fresh mount per open, so the totals count up and the rows cascade in
  // every time it opens rather than only the first.
  return createPortal(<Sheet {...props} />, document.body)
}

function Sheet({ onClose, from, to, result, filtered }: PeriodReturnModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const measuredDays = result.days.filter((d) => d.pct !== null)
  const maxAbs = Math.max(1e-9, ...measuredDays.map((d) => Math.abs(d.pct ?? 0)))
  const gap =
    result.added !== null && result.compounded !== null
      ? result.compounded - result.added
      : null

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-[2px] animate-[fadeup_0.22s_ease_both]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Period Return breakdown"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[640px] flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-[0_24px_70px_-20px_rgba(0,0,0,0.6)] animate-[dtm-in_0.28s_ease-out_both]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-[22px] pb-4 max-[640px]:p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-accent-line bg-accent-soft text-accent">
              <Sigma size={17} />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-[18px] font-extrabold leading-tight">
                Period Return
              </h3>
              <p className="mt-1 font-mono text-[12px] text-muted">
                {fmtMediumDate(from)} → {fmtMediumDate(to)}
                {filtered && ' · filtered trades'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] border border-border bg-surface2 text-muted cursor-pointer transition-colors hover:text-text hover:border-accent-line"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-[22px] pb-[22px] max-[640px]:px-4 max-[640px]:pb-4">
          {/* The two methods, side by side */}
          <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
            <MethodTile
              icon={<Plus size={13} />}
              label="Added"
              badge="Shown on card"
              value={result.added}
              gross={result.addedGross}
              formula={addedFormula(result)}
              accent
              delay={0}
            />
            <MethodTile
              icon={<TrendingUp size={13} />}
              label="Compounded"
              value={result.compounded}
              gross={result.compoundedGross}
              formula={compoundedFormula(result)}
              delay={90}
            />
          </div>

          {gap !== null && Math.abs(gap) >= 0.005 && (
            <p className="-mt-1 text-center font-mono text-[11.5px] text-faint animate-[fadeup_0.4s_ease-out_0.25s_both]">
              Compounding {gap >= 0 ? 'adds' : 'takes off'}{' '}
              <span className="text-muted">{Math.abs(gap).toFixed(2)} pts</span> over this range
            </p>
          )}

          {/* Day by day */}
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.5px] text-faint">
                Day by day · after fees
              </span>
              <span className="font-mono text-[11px] text-faint">
                {result.measured} day{result.measured === 1 ? '' : 's'}
                {result.unmeasured > 0 && ` · ${result.unmeasured} unmeasured`}
              </span>
            </div>

            {result.days.length === 0 ? (
              <p className="rounded-[12px] border border-hair bg-surface2 px-4 py-8 text-center text-[13px] text-muted">
                No closed trades in this range.
              </p>
            ) : (
              <div className="max-h-[42vh] overflow-y-auto rounded-[12px] border border-hair">
                <table className="w-full border-collapse text-[12.5px]">
                  <thead className="sticky top-0 z-[1] bg-surface2">
                    <tr className="text-left text-[10.5px] font-extrabold uppercase tracking-[0.4px] text-faint [&>th]:px-3 [&>th]:py-2.5">
                      <th>Day</th>
                      <th className="text-right max-[640px]:hidden">Start bal.</th>
                      <th className="text-right">P&amp;L</th>
                      <th className="w-[34%] text-right">Day %</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.days.map((d, i) => {
                      const pos = (d.pct ?? 0) >= 0
                      // Cascade the first rows in; past ~24 the rest arrive
                      // together so a long range does not take seconds to fill.
                      const delay = `${Math.min(i, 24) * 28}ms`
                      return (
                        <tr
                          key={d.date}
                          className="border-t border-hair font-mono transition-colors hover:bg-surface2/60 animate-[fadeup_0.35s_ease-out_both] [&>td]:px-3 [&>td]:py-2"
                          style={{ animationDelay: delay }}
                        >
                          <td className="whitespace-nowrap font-body font-semibold text-text">
                            {fmtShortDate(d.date)}
                          </td>
                          <td className="text-right text-muted max-[640px]:hidden">
                            {d.startBalance !== null && d.startBalance > 0
                              ? fmtMoney(d.startBalance)
                              : '—'}
                          </td>
                          <td className={`text-right whitespace-nowrap ${d.pnl < 0 ? 'text-red' : 'text-green'}`}>
                            {fmtSignedMoney(d.pnl)}
                          </td>
                          <td className="text-right">
                            {d.pct === null ? (
                              <span className="text-faint" title="No balance on record for this day — left out of both totals.">
                                —
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <span className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-hair max-[420px]:hidden">
                                  <span
                                    className={`absolute inset-y-0 left-0 origin-left rounded-full animate-[growx_0.6s_ease-out_both] ${pos ? 'bg-green' : 'bg-red'}`}
                                    style={{
                                      width: `${(Math.abs(d.pct) / maxAbs) * 100}%`,
                                      animationDelay: delay,
                                    }}
                                  />
                                </span>
                                <span className={`w-[64px] text-right font-bold ${pos ? 'text-green' : 'text-red'}`}>
                                  {fmtSignedPct(d.pct, 2)}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="text-right whitespace-nowrap text-text">
                            {fmtSignedPct(d.running, 2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 rounded-[12px] border border-hair bg-surface2 px-3.5 py-3 text-[12px] leading-[1.5] text-muted">
            <p>
              <span className="font-bold text-text">Added</span> — each day&apos;s % of the
              balance it started with, summed. Matches the P&amp;L calendar day for day.
            </p>
            <p>
              <span className="font-bold text-text">Compounded</span> — the same days, each
              building on the last: how the account actually grew. The landing page and
              the monthly recap use this one.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-[38px] rounded-btn border border-border bg-surface2 px-4 text-[13px] font-bold font-body text-text cursor-pointer transition-colors hover:border-accent-line"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface MethodTileProps {
  icon: ReactNode
  label: string
  badge?: string
  value: number | null
  gross: number | null
  formula: string
  accent?: boolean
  delay: number
}

/** One method's total, counting up from zero as the modal opens. */
function MethodTile({ icon, label, badge, value, gross, formula, accent, delay }: MethodTileProps) {
  const shown = useTween(value ?? 0, 900, 0)
  const negative = (value ?? 0) < 0
  return (
    <div
      className={`relative overflow-hidden rounded-[14px] border px-4 py-3.5 animate-[fadeup_0.4s_ease-out_both] ${
        accent
          ? 'border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))]'
          : 'border-hair bg-surface2'
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <Sheen delay={delay + 350} />
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.5px] text-faint">
          <span className={accent ? 'text-accent' : 'text-muted'}>{icon}</span>
          {label}
        </span>
        {badge && (
          <span className="rounded-pill border border-accent-line bg-accent-soft px-2 py-[2px] text-[10px] font-bold text-accent">
            {badge}
          </span>
        )}
      </div>
      <div
        className={`mt-1.5 font-mono text-[26px] font-extrabold tracking-[-0.6px] tabular-nums ${
          negative ? 'text-red' : accent ? 'text-accent' : 'text-text'
        }`}
      >
        {value === null ? '—' : fmtSignedPct(shown, 2)}
      </div>
      <div className="mt-0.5 truncate font-mono text-[11.5px] text-muted" title={formula}>
        {formula}
      </div>
      {gross !== null && (
        <div className="mt-1.5 border-t border-hair pt-1.5 font-mono text-[11px] text-faint">
          Before fees: {fmtSignedPct(gross, 2)}
        </div>
      )}
    </div>
  )
}

/** "1.00% + 4.00%" for a short range; a count for a long one. */
function addedFormula(r: PeriodReturn): string {
  const pcts = r.days.map((d) => d.pct).filter((p): p is number => p !== null)
  if (pcts.length === 0) return 'No measured days'
  if (pcts.length > 4) return `Sum of ${pcts.length} daily returns`
  return pcts
    .map((p, i) =>
      i === 0
        ? `${p < 0 ? '−' : ''}${Math.abs(p).toFixed(2)}%`
        : `${p < 0 ? '−' : '+'} ${Math.abs(p).toFixed(2)}%`,
    )
    .join(' ')
}

/** "1.01 × 1.04 − 1" for a short range; a description for a long one. */
function compoundedFormula(r: PeriodReturn): string {
  const pcts = r.days.map((d) => d.pct).filter((p): p is number => p !== null)
  if (pcts.length === 0) return 'No measured days'
  if (pcts.length > 3) return 'Each day builds on the last'
  return `${pcts.map((p) => (1 + p / 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')).join(' × ')} − 1`
}

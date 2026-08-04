import { useState } from 'react'
import { PiggyBank, TrendingUp } from 'lucide-react'
import { fmtMoney, fmtSignedMoney, fmtSignedPct } from '../../lib/format'
import type { ReturnOnDeposit } from '../../types/analytics'

type Face = 'total' | 'deposit'

interface ReturnFlipCardProps {
  totalReturnPct: number | null
  totalReturnAbs: number
  returnOnDeposit: ReturnOnDeposit
  /** True when a symbol / strategy chip is active. */
  filtered: boolean
}

const CARD =
  'rounded-card p-card border border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))] flex flex-col gap-2'
const LABEL =
  'inline-flex items-center gap-[5px] text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase pt-[5px]'
const VALUE = 'font-mono text-[27px] font-extrabold tracking-[-0.6px]'
const ICON_BTN =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent cursor-pointer transition-colors hover:bg-accent hover:text-on-accent'

interface FaceProps {
  active: boolean
  label: string
  value: string
  negative: boolean
  barPct: number
  hint: string
  note: string
  icon: typeof TrendingUp
  onFlip: () => void
  flipTitle: string
  face: Face
  onSelect: (face: Face) => void
}

/**
 * One side of the card. Both faces share this skeleton so they measure the
 * same height — the back is absolutely positioned over the front, which is
 * what sets the card's height.
 */
function CardFace({
  active,
  label,
  value,
  negative,
  barPct,
  hint,
  note,
  icon: Icon,
  onFlip,
  flipTitle,
  face,
  onSelect,
}: FaceProps) {
  // The inactive face stays in the DOM (it is mid-flip), so keep it out of
  // the tab order and off the accessibility tree.
  const tab = active ? 0 : -1

  return (
    <div className={`${CARD} h-full`} aria-hidden={!active}>
      <div className="flex items-start justify-between gap-2.5 mb-1">
        <span className={LABEL}>{label}</span>
        <button
          type="button"
          onClick={onFlip}
          tabIndex={tab}
          title={flipTitle}
          aria-label={flipTitle}
          className={ICON_BTN}
        >
          <Icon size={16} />
        </button>
      </div>

      <div className={`${VALUE} ${negative ? 'text-red' : 'text-accent'}`}>
        {value}
      </div>
      <div className="text-[11.5px] font-semibold text-muted">{hint}</div>

      <div className="mt-2 h-1.5 bg-surface2 rounded-[3px] overflow-hidden">
        <div
          className="h-full rounded-[3px] bg-[linear-gradient(90deg,var(--accent),var(--accentStrong,var(--accent)))] transition-[width] duration-500"
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 mt-1.5">
        <span className="text-[10.5px] text-faint font-semibold truncate">
          {note}
        </span>
        {/* Which side is showing — and a shortcut straight to the other. */}
        <span className="flex items-center gap-1.5 shrink-0">
          {(['total', 'deposit'] as Face[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              tabIndex={tab}
              aria-label={
                id === 'total' ? 'Show total return' : 'Show return on deposit'
              }
              aria-pressed={face === id}
              className={`h-1.5 rounded-[3px] cursor-pointer transition-all ${
                face === id ? 'w-4 bg-accent' : 'w-1.5 bg-border hover:bg-muted'
              }`}
            />
          ))}
        </span>
      </div>
    </div>
  )
}

/**
 * The lead KPI card, flippable between two different questions:
 *
 *  - **Total Return** — everything the account made (realized + unrealized)
 *    over the capital committed to it (deposits net of withdrawals).
 *  - **Return on Deposit** — closed-trade P&L over the money actually paid
 *    in, ignoring withdrawals and always all-time.
 *
 * They answer different things and routinely disagree, which is the point of
 * putting them back to back rather than picking one.
 */
export default function ReturnFlipCard({
  totalReturnPct,
  totalReturnAbs,
  returnOnDeposit,
  filtered,
}: ReturnFlipCardProps) {
  const [face, setFace] = useState<Face>('total')
  const flip = () => setFace((f) => (f === 'total' ? 'deposit' : 'total'))

  const bar = (pct: number | null) => Math.min(100, Math.max(0, pct ?? 0))

  return (
    // h-full all the way down so the card still fills the KPI row when a
    // neighbouring card is the tallest — the back face is absolute and
    // contributes no height of its own.
    <div className="[perspective:1200px] h-full">
      <div
        className={`relative h-full transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none ${
          face === 'deposit' ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        <div className="h-full [backface-visibility:hidden]">
          <CardFace
            active={face === 'total'}
            label={filtered ? 'Filtered Return' : 'Total Return'}
            value={
              totalReturnPct === null ? '—' : fmtSignedPct(totalReturnPct)
            }
            negative={(totalReturnPct ?? totalReturnAbs) < 0}
            barPct={bar(totalReturnPct)}
            hint={`${fmtSignedMoney(totalReturnAbs)} ${
              filtered ? 'on the selection' : 'absolute return'
            }`}
            note={
              filtered
                ? 'Realized only · open positions excluded'
                : 'Realized + unrealized on committed capital'
            }
            icon={TrendingUp}
            onFlip={flip}
            flipTitle="Flip to return on deposit"
            face={face}
            onSelect={setFace}
          />
        </div>

        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <CardFace
            active={face === 'deposit'}
            label="Return on Deposit"
            value={
              returnOnDeposit.pct === null
                ? '—'
                : fmtSignedPct(returnOnDeposit.pct, 2)
            }
            negative={(returnOnDeposit.pct ?? returnOnDeposit.realized) < 0}
            barPct={bar(returnOnDeposit.pct)}
            hint={
              returnOnDeposit.deposits > 0
                ? `${fmtSignedMoney(returnOnDeposit.realized)} on ${fmtMoney(returnOnDeposit.deposits)} deposited`
                : 'No deposits on record yet'
            }
            note={`All-time · ${returnOnDeposit.trades.toLocaleString('en-US')} closed trades`}
            icon={PiggyBank}
            onFlip={flip}
            flipTitle="Flip to total return"
            face={face}
            onSelect={setFace}
          />
        </div>
      </div>
    </div>
  )
}

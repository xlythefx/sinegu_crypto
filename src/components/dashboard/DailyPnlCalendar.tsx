import { useMemo, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApiData } from '../../hooks/useApiData'
import { getDashboardDailyPnl } from '../../services/dashboard'
import type { ExchangeFilter } from '../../context/ExchangeFilterContext'
import { deleteAdminPastTrade, updateAdminPastTrade } from '../../services/admin'
import { getApiErrorMessage } from '../../services/api'
import { canSeeAdmin } from '../../lib/roles'
import { getUser } from '../../lib/session'
import { displaySymbol } from '../../lib/chart'
import { fmtMediumDate, fmtSignedPct } from '../../lib/format'
import type { PositionRow } from '../../lib/adminPositionRows'
import DayTradesModal from './DayTradesModal'
import PositionEditModal, {
  type PositionEditPayload,
} from '../admin/positions/PositionEditModal'
import ConfirmModal from '../ui/ConfirmModal'
import PnlBreakdown from '../ui/PnlBreakdown'
import type { DayPnl, DayTrade } from '../../types/dashboard'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** Base calendar cell (also used by blank cells). Mirrors the old .dcal__cell. */
const cellBase =
  'relative min-h-[58px] border border-hair rounded-btn py-[7px] px-2 flex flex-col items-start justify-between bg-surface2 text-left transition-[transform,box-shadow,border-color] duration-150 ease-[ease] max-[900px]:min-h-[46px] max-[900px]:py-[5px] max-[900px]:px-1.5'

const cellValue =
  'font-mono text-[11.5px] font-bold leading-tight max-[900px]:text-[9.5px]'
const cellPct =
  'font-mono text-[10px] font-semibold leading-tight opacity-80 max-[900px]:text-[8.5px]'

const toneText = (n: number) => (n > 0 ? 'text-green' : n < 0 ? 'text-red' : 'text-faint')

/** "+$42" / "−$9" — whole dollars; a cell has no room for cents. */
function cellAmount(pnl: number): string {
  if (pnl === 0) return '—'
  return `${pnl > 0 ? '+' : '−'}$${Math.abs(pnl).toFixed(0)}`
}

interface DailyPnlCalendarProps {
  /** The top-bar scope — the days come from that venue's tables (or all). */
  exchange?: ExchangeFilter
}

interface Cell {
  day: number | null
  iso: string
  data: DayPnl | null
}

function isoKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildCells(
  year: number,
  month: number,
  days: Record<string, DayPnl>,
): Cell[] {
  const first = new Date(year, month, 1).getDay()
  const count = new Date(year, month + 1, 0).getDate()
  const cells: Cell[] = []
  for (let i = 0; i < first; i++) cells.push({ day: null, iso: '', data: null })
  for (let d = 1; d <= count; d++) {
    const iso = isoKey(year, month, d)
    cells.push({ day: d, iso, data: days[iso] ?? null })
  }
  return cells
}

/** A day's trade wearing the shape the shared position editor expects. The
 *  account fields are empty on purpose: this list is already scoped to the
 *  viewer's own accounts, and the editor never writes ownership anyway. */
function toEditableRow(t: DayTrade): PositionRow {
  return {
    key: `t${t.id}`,
    ids: [t.id],
    count: 1,
    rowId: t.id,
    accountId: null,
    accountName: null,
    accountBalance: 0,
    symbol: t.symbol,
    price: t.exit_price ?? 0,
    pnl: t.realized_pnl,
    fee: t.exchange_fee,
    feeSource: t.fee_source,
    side: t.side,
    qty: t.position_amt,
    strategy: t.strategy,
    closedAt: t.closed_at,
    broker: 'Binance',
  }
}

/** Daily P&L calendar — month grid tinted by P&L sign + magnitude, with month
 *  navigation and a click-to-open trades modal per day. Each cell carries the
 *  day's amount and its percentage of the balance that day STARTED with
 *  (server-computed, so a later deposit never rewrites an earlier day). */
export default function DailyPnlCalendar({
  exchange = 'all',
}: DailyPnlCalendarProps) {
  const { data: days, reload } = useApiData(
    () => getDashboardDailyPnl(exchange),
    [exchange],
  )
  // Same predicate as the sidebar's admin button and as EnsureAdmin::ROLES on
  // the server — the icons are cosmetic, the /admin/* endpoints do the gating.
  // Being allowed only makes the popup's tap gesture live; the icons
  // themselves stay hidden until it fires (see DayTradesModal).
  const canManage = canSeeAdmin(getUser()?.type)
  const [editTrade, setEditTrade] = useState<DayTrade | null>(null)
  const [pendingEdit, setPendingEdit] = useState<PositionEditPayload | null>(null)
  const [deleteTrade, setDeleteTrade] = useState<DayTrade | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [])
  const [view, setView] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1)
  )
  const [selected, setSelected] = useState<string | null>(null)

  const daysMap = days ?? {}

  const cells = useMemo(
    () => buildCells(view.getFullYear(), view.getMonth(), daysMap),
    [view, daysMap]
  )
  const monthLabel = view.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const total = (c: Cell) => c.data?.total ?? 0
  const winDays = cells.filter((c) => c.day && total(c) > 0).length
  const lossDays = cells.filter((c) => c.day && total(c) < 0).length
  const maxAbs = Math.max(1, ...cells.map((c) => Math.abs(total(c))))
  const canGoNext =
    view.getFullYear() < now.getFullYear() ||
    (view.getFullYear() === now.getFullYear() &&
      view.getMonth() < now.getMonth())

  const runEdit = async () => {
    if (!pendingEdit || pendingEdit.kind !== 'trade') return
    setBusy(true)
    setActionError(null)
    try {
      await updateAdminPastTrade(pendingEdit.id, pendingEdit.input)
      setPendingEdit(null)
      setEditTrade(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Failed to save the change.'))
      setPendingEdit(null)
    } finally {
      setBusy(false)
    }
  }

  const runDelete = async () => {
    if (!deleteTrade) return
    setBusy(true)
    setActionError(null)
    try {
      await deleteAdminPastTrade(deleteTrade.id)
      setDeleteTrade(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Failed to delete the trade.'))
      setDeleteTrade(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="rounded-card p-card border border-border bg-surface grow basis-[480px] min-w-0"
      data-aos="fade-up"
      data-aos-delay="300"
    >
      <div className="flex items-center justify-between mb-stack gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <CalendarIcon size={16} />
          </span>
          <div>
            <div className="font-display text-[15px] font-extrabold">
              Daily P&L Calendar
            </div>
            <div className="text-[12px] text-muted mt-px">
              {winDays} green / {lossDays} red days · click a day for its trades
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center justify-center w-[30px] h-[30px] rounded-btn border border-border bg-surface text-accent cursor-pointer disabled:text-faint disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() =>
              setView(
                (v) => new Date(v.getFullYear(), v.getMonth() - 1, 1)
              )
            }
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[116px] text-center text-[13px] font-extrabold">
            {monthLabel}
          </span>
          <button
            type="button"
            className="flex items-center justify-center w-[30px] h-[30px] rounded-btn border border-border bg-surface text-accent cursor-pointer disabled:text-faint disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!canGoNext}
            onClick={() =>
              canGoNext &&
              setView(
                (v) => new Date(v.getFullYear(), v.getMonth() + 1, 1)
              )
            }
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* a failed edit/delete can outlive the modal it was started from */}
      {actionError && !editTrade && (
        <p
          className="mb-3 py-2 px-3 border border-[color-mix(in_srgb,var(--red)_30%,transparent)] rounded-field bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-[12.5px] text-red"
          role="alert"
        >
          {actionError}
        </p>
      )}

      <div className="grid grid-cols-7 gap-[7px] mb-[7px]">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="font-mono text-[10px] font-semibold text-faint text-center tracking-[0.5px]"
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[7px]">
        {cells.map((c, i) => {
          if (c.day === null)
            return (
              <div
                key={`blank-${i}`}
                className={`${cellBase} border-dashed`}
              />
            )
          const pnl = total(c)
          const mag =
            pnl !== 0
              ? 0.16 + Math.min(0.6, (Math.abs(pnl) / maxAbs) * 0.6)
              : 0
          const bg =
            pnl > 0
              ? `rgba(47, 214, 122, ${mag.toFixed(3)})`
              : pnl < 0
                ? `rgba(255, 90, 90, ${mag.toFixed(3)})`
                : undefined
          const toneClass =
            pnl > 0
              ? ' border-[rgba(47,214,122,0.55)]'
              : pnl < 0
                ? ' border-[rgba(255,90,90,0.55)]'
                : ''
          const clickable = c.data
            ? ' cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.22)]'
            : ''
          const count = c.data?.trades.length ?? 0
          return (
            <button
              type="button"
              key={`day-${c.iso}`}
              className={`${cellBase}${toneClass}${clickable}`}
              style={{ background: bg }}
              onClick={() => c.data && setSelected(c.iso)}
              disabled={!c.data}
            >
              <span className="text-[11px] font-bold text-faint">{c.day}</span>
              {/* A cell is what LANDED that day (after fees); hovering it shows
                  what the strategy made before fees. hoverOnly: the tap is
                  already the popup's, and the popup's header repeats this. */}
              {c.data ? (
                <PnlBreakdown
                  hoverOnly
                  gross={c.data.total_gross}
                  net={c.data.total}
                  heading={fmtMediumDate(c.iso)}
                  note={c.data.fees === 0 ? 'No exchange fee on record for this day.' : undefined}
                >
                  <span className="flex flex-col items-start">
                    <span className={`${cellValue} ${toneText(pnl)}`}>
                      {cellAmount(pnl)}
                    </span>
                    {c.data.pct !== null && pnl !== 0 && (
                      <span className={`${cellPct} ${toneText(pnl)}`}>
                        {fmtSignedPct(c.data.pct, 2)}
                      </span>
                    )}
                  </span>
                </PnlBreakdown>
              ) : (
                <span className={`${cellValue} text-faint`}>{cellAmount(pnl)}</span>
              )}
              {count > 0 && (
                <span className="absolute top-[5px] right-[5px] min-w-[15px] h-[15px] px-1 inline-flex items-center justify-center rounded-pill bg-surface border border-border font-mono text-[9px] font-bold text-muted">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <DayTradesModal
        date={selected}
        day={selected ? daysMap[selected] ?? null : null}
        onClose={() => setSelected(null)}
        canManage={canManage}
        onEditTrade={(t) => {
          setActionError(null)
          setEditTrade(t)
        }}
        onDeleteTrade={(t) => {
          setActionError(null)
          setDeleteTrade(t)
        }}
      />

      <PositionEditModal
        row={editTrade ? toEditableRow(editTrade) : null}
        kind="trade"
        saving={busy}
        error={actionError}
        confirming={pendingEdit !== null}
        subtitle={
          editTrade
            ? `Closed trade #${editTrade.id} · ${displaySymbol(editTrade.symbol)} · ${fmtMediumDate(editTrade.closed_at)}`
            : undefined
        }
        onSubmit={setPendingEdit}
        onCancel={() => {
          setEditTrade(null)
          setActionError(null)
        }}
      />

      <ConfirmModal
        open={pendingEdit !== null}
        title={`Update trade #${pendingEdit?.id ?? ''}?`}
        message={
          pendingEdit
            ? `${pendingEdit.changes.join(' · ')}. Invoicing and the public track record read these figures.`
            : ''
        }
        confirmLabel={busy ? 'Saving…' : 'Yes, update'}
        cancelLabel="No"
        onConfirm={runEdit}
        onCancel={() => setPendingEdit(null)}
      />

      <ConfirmModal
        open={deleteTrade !== null}
        title="Delete this trade?"
        message={
          deleteTrade
            ? `This permanently removes trade #${deleteTrade.id} — ${displaySymbol(deleteTrade.symbol)} closed ${fmtMediumDate(deleteTrade.closed_at)}. The day's P&L, invoicing and the public track record all stop counting it.`
            : ''
        }
        confirmLabel={busy ? 'Deleting…' : 'Yes, delete'}
        cancelLabel="No"
        danger
        onConfirm={runDelete}
        onCancel={() => setDeleteTrade(null)}
      />
    </section>
  )
}

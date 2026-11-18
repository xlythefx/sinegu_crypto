import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, History, Mail, ShieldAlert, Siren } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { ApiError, getApiErrorMessage } from '../../../services/api'
import {
  getRiskAlerts,
  resolveRiskAlert,
  RISK_ALERT_ALREADY_RESOLVED,
} from '../../../services/riskAlerts'
import { fmtDateTime } from '../../../lib/format'
import { riskAlertCount, riskAlertFix } from '../../../lib/riskAlerts'
import { EXCHANGE_META } from '../../exchanges/meta'
import type { ExchangeKind } from '../../../types/exchanges'
import type { RiskAlert, RiskAlertHistoryRow } from '../../../types/riskAlerts'

const RED_BORDER = 'border-[color-mix(in_srgb,var(--red)_45%,var(--border))]'
const RED_SOFT = 'bg-[color-mix(in_srgb,var(--red)_7%,transparent)]'
const BTN =
  'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50'

const venue = (exchange: string | null) =>
  exchange ? (EXCHANGE_META[exchange as ExchangeKind]?.label ?? exchange) : null

/** First / last seen, and how often — the line under each alert's text. */
function SeenLine({ alert }: { alert: RiskAlert }) {
  const parts: string[] = []
  if (alert.occurrences > 1) {
    parts.push(`Seen ${alert.occurrences} times`)
    if (alert.first_seen_at) parts.push(`first ${fmtDateTime(alert.first_seen_at)}`)
    if (alert.last_seen_at) parts.push(`last ${fmtDateTime(alert.last_seen_at)}`)
  } else if (alert.first_seen_at) {
    parts.push(`Seen ${fmtDateTime(alert.first_seen_at)}`)
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-faint">
      <span>{parts.join(' · ')}</span>
      {alert.emailed && (
        <span className="inline-flex items-center gap-1" title="Emailed to the high-risk list when it was raised">
          <Mail size={11} aria-hidden="true" /> emailed
        </span>
      )}
    </p>
  )
}

/** The alert's body: kicker, title, the sentences the API wrote, when. */
function AlertBody({ alert }: { alert: RiskAlert }) {
  const where = venue(alert.exchange)
  return (
    <div className="min-w-0 flex-1">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-red">
        <span>{alert.label}</span>
        {where && <span className="text-faint">· {where}</span>}
        {alert.trade_log_id !== null && <span className="text-faint">· Signal #{alert.trade_log_id}</span>}
      </p>
      <p className="mt-1 text-[13.5px] font-semibold leading-snug text-text break-words">{alert.title}</p>
      {alert.lines.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {alert.lines.map((line, i) => (
            <li key={i} className="text-[12.5px] leading-[1.5] text-muted break-words">
              {line}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <SeenLine alert={alert} />
      </div>
    </div>
  )
}

/**
 * Overview → Needs attention, at the very top: the high-risk alerts — a
 * wrong account filling on a feed, a close that will not go through, the kill
 * switch, a house key refused, the engine down, the coin list unreadable.
 * Each was emailed when raised; it stays here until a full admin says it is
 * dealt with ("Mark resolved", confirmed, with an optional note).
 *
 * Absent for a collaborator (the API omits the list), so this never renders
 * for one. "Show resolved" reads the history on demand.
 */
export default function RiskAlertsCard({
  alerts,
  onResolved,
}: {
  alerts: RiskAlert[]
  /** Refetch the overview — the API has already forgotten its cache. */
  onResolved: () => void
}) {
  const [target, setTarget] = useState<RiskAlert | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<RiskAlertHistoryRow[] | null>(null)
  const [showResolved, setShowResolved] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadHistory = async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      setHistory(await getRiskAlerts('all'))
    } catch (err) {
      setHistoryError(getApiErrorMessage(err, 'Could not load resolved alerts.'))
    } finally {
      setHistoryLoading(false)
    }
  }

  const toggleResolved = () => {
    const next = !showResolved
    setShowResolved(next)
    if (next) void loadHistory()
  }

  const run = async () => {
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      await resolveRiskAlert(target.id, note)
      onResolved()
      if (showResolved) void loadHistory()
    } catch (err) {
      // Someone else resolved it first: the refetch simply drops it.
      if (err instanceof ApiError && err.errorCode === RISK_ALERT_ALREADY_RESOLVED) {
        onResolved()
      } else {
        setError(getApiErrorMessage(err, 'Could not mark the alert resolved.'))
      }
    } finally {
      setTarget(null)
      setNote('')
      setBusy(false)
    }
  }

  const resolved = (history ?? []).filter((a) => a.resolved_at !== null)

  return (
    <section
      className={`flex min-w-0 flex-col rounded-card border ${alerts.length > 0 ? RED_BORDER : 'border-border'} bg-surface p-card max-[480px]:p-3.5`}
      id="risk-alerts"
      style={{ scrollMarginTop: 16 }}
      aria-labelledby="risk-alerts-title"
    >
      <div
        className={`flex flex-wrap items-start gap-x-2.5 gap-y-2 ${alerts.length > 0 || error ? 'mb-3.5' : ''}`}
      >
        <span
          className={`grid h-7 w-7 flex-none place-items-center rounded-[9px] ${
            alerts.length > 0 ? 'bg-red text-white' : 'border border-hair bg-surface2 text-muted'
          }`}
        >
          <Siren size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 basis-[200px]">
          <h2 id="risk-alerts-title" className="font-display text-[15px] font-extrabold text-text">
            High-risk alerts
          </h2>
          <p className="mt-px text-[12px] leading-[1.5] text-muted">
            {alerts.length > 0
              ? `${riskAlertCount(alerts.length)} open. Each was emailed when it happened — fix it, then mark it resolved.`
              : 'Nothing open. Anything that can lose real money shows up here and is emailed.'}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleResolved}
          aria-pressed={showResolved}
          className="inline-flex flex-none items-center gap-1 rounded-btn px-2 py-1 text-[12px] font-semibold text-muted hover:bg-surface2 hover:text-text"
        >
          <History size={13} aria-hidden="true" />
          {showResolved ? 'Hide resolved' : 'Show resolved'}
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-row border border-red/40 bg-red/10 px-3.5 py-2.5 text-[12.5px] text-red" role="alert">
          {error}
        </p>
      )}

      {alerts.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {alerts.map((alert) => {
            const fix = riskAlertFix(alert.kind)
            return (
              <li
                key={alert.id}
                className={`flex flex-col gap-3 rounded-row border ${RED_BORDER} ${RED_SOFT} px-4 py-3.5 max-[480px]:px-3.5 sm:flex-row sm:items-start`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <ShieldAlert size={17} className="mt-[3px] flex-none text-red" aria-hidden="true" />
                  <AlertBody alert={alert} />
                </div>
                <div className="flex flex-none flex-wrap items-center gap-2 pl-[29px] sm:flex-col sm:items-end sm:pl-0">
                  {fix && (
                    <Link to={fix.to} className={`${BTN} border-red/40 text-red hover:bg-red/10`}>
                      {fix.label} <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setNote('')
                      setTarget(alert)
                    }}
                    className={`${BTN} border-border bg-surface text-text hover:border-green/50 hover:text-green`}
                  >
                    <CheckCircle2 size={13} aria-hidden="true" /> Mark resolved
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {showResolved && (
        <div className="mt-4 flex flex-col gap-2.5 border-t border-hair pt-4 animate-[fadeup_0.35s_ease-out]">
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">
            Resolved (latest 100)
          </p>
          {historyLoading && !history ? (
            <p className="text-[12.5px] text-muted">Loading…</p>
          ) : historyError ? (
            <p className="text-[12.5px] text-red">{historyError}</p>
          ) : resolved.length === 0 ? (
            <p className="text-[12.5px] text-muted">No resolved alert yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {resolved.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-row border border-border bg-surface2 px-4 py-3 max-[480px]:px-3.5">
                  <CheckCircle2 size={16} className="mt-[3px] flex-none text-green" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">
                      {a.label}
                      {venue(a.exchange) ? ` · ${venue(a.exchange)}` : ''}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold leading-snug text-text break-words">{a.title}</p>
                    <p className="mt-1 text-[12px] leading-[1.5] text-muted break-words">
                      Resolved {a.resolved_at ? fmtDateTime(a.resolved_at) : ''}
                      {a.resolved_by ? ` by ${a.resolved_by}` : ''}
                      {a.resolve_note ? ` — ${a.resolve_note}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmModal
        open={target !== null}
        title="Mark this alert resolved?"
        message="It leaves the Overview for everyone. Only do this once the cause is fixed — if it happens again, a new alert is raised and emailed."
        confirmLabel={busy ? 'Working…' : 'Yes, resolved'}
        cancelLabel="Cancel"
        confirmDisabled={busy}
        onConfirm={() => void run()}
        onCancel={() => {
          if (busy) return
          setTarget(null)
          setNote('')
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-[10.5px] uppercase tracking-[0.1em] text-faint">
            What was done (optional)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="e.g. Moved the account back to the main feed and closed the stray position."
            className="w-full resize-none rounded-[12px] border border-border bg-surface2 px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent"
          />
        </label>
      </ConfirmModal>
    </section>
  )
}

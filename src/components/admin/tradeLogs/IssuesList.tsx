import { Link } from 'react-router-dom'
import { AlertTriangle, ListFilter, PartyPopper } from 'lucide-react'
import FixLink from './FixLink'
import { FIX_BTN, LABEL_CHIP, TONE } from './tradeLogClasses'
import { EXCHANGE_META } from '../../exchanges/meta'
import { fmtDateTime, fmtMediumDate } from '../../../lib/format'
import { plural } from '../../../lib/signalHealth'
import type { SignalIssue, TradeLogIssuesData } from '../../../types/tradeLogs'

/** "the last 7 days" (the API's default window) or the dates the admin chose. */
function periodText(from: string, to: string): string {
  if (from && to) return `${fmtMediumDate(from)} – ${fmtMediumDate(to)}`
  if (from) return `since ${fmtMediumDate(from)}`
  if (to) return `up to ${fmtMediumDate(to)}`
  return 'the last 7 days'
}

/**
 * Every problem in the window grouped by cause — one card per reason on one
 * account, so a refused key repeating on forty signals reads as ONE thing to
 * fix, not forty alarms. Normal skips sit underneath as plain counts.
 */
export default function IssuesList({
  data,
  from,
  to,
  onShowSignals,
}: {
  data: TradeLogIssuesData
  from: string
  to: string
  onShowSignals: (issue: SignalIssue) => void
}) {
  const { issues, normal, signals } = data
  const period = periodText(from, to)

  return (
    <div className="flex flex-col gap-2.5">
      {issues.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-[30px] text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-green/15 text-green">
            <PartyPopper size={20} aria-hidden="true" />
          </span>
          <p className="text-[14px] font-semibold text-text">No problems in this period</p>
          <p className="text-[12.5px] text-muted">
            {signals === 0
              ? `No signals in ${period}.`
              : `${plural(signals, 'signal', 'signals')} checked over ${period}.`}
          </p>
        </div>
      ) : (
        <>
          <p className="text-[12.5px] text-muted">
            <span className="font-semibold text-text">
              {plural(issues.length, 'problem', 'problems')}
            </span>{' '}
            across {plural(signals, 'signal', 'signals')} in {period} — most recent first.
          </p>
          {issues.map((issue) => (
            <IssueCard key={issue.key} issue={issue} onShowSignals={onShowSignals} />
          ))}
        </>
      )}

      {normal.length > 0 && (
        <div className="mt-2 border-t border-hair pt-4">
          <p className="mb-2.5 text-[12px] font-semibold text-muted">Normal — no action needed</p>
          <div className="flex flex-wrap gap-1.5">
            {normal.map((r) => (
              <span key={r.key} className={`${LABEL_CHIP} ${TONE.neutral}`}>
                {r.label}
                <span className="ml-0.5 font-mono font-normal text-faint">{r.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function IssueCard({
  issue,
  onShowSignals,
}: {
  issue: SignalIssue
  onShowSignals: (issue: SignalIssue) => void
}) {
  const exchangeLabel = issue.exchange
    ? (EXCHANGE_META[issue.exchange]?.label ?? issue.exchange)
    : null
  const name = issue.isMaster ? 'Master account' : (issue.userName ?? issue.account)
  // The account name is worth printing beside a person's name, not twice.
  const account = issue.account && issue.account !== name ? issue.account : null
  const once = issue.count === 1 || issue.firstAt === issue.lastAt

  return (
    <article className="rounded-card border border-[color-mix(in_srgb,var(--red)_28%,var(--border))] bg-surface p-card max-[480px]:p-3.5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-red/15 text-red">
          <AlertTriangle size={17} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-[1.4] text-red">{issue.label}</p>

          {(name || exchangeLabel) && (
            <p className="mt-1 break-words text-[13px] leading-[1.5] text-text">
              {name &&
                (issue.uniId ? (
                  <Link
                    to={`/admin/users/${issue.uniId}`}
                    className="font-semibold hover:text-accent hover:underline"
                  >
                    {name}
                  </Link>
                ) : (
                  <span className="font-semibold">{name}</span>
                ))}
              {account && <span className="text-muted"> — {account}</span>}
              {exchangeLabel && (
                <span className="text-muted">
                  {name ? ' · ' : ''}
                  {exchangeLabel}
                </span>
              )}
            </p>
          )}

          {issue.tickers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {issue.tickers.map((t) => (
                <span
                  key={t}
                  className="rounded-pill border border-hair bg-surface2 px-2 py-[1px] font-mono text-[11.5px] text-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <p className="mt-2 text-[12px] leading-[1.5] text-muted">
            <span className="font-semibold text-text">
              {issue.count === 1 ? 'Once' : `${issue.count} times`}
            </span>
            {once
              ? issue.lastAt && ` · ${fmtDateTime(issue.lastAt)}`
              : (
                  <>
                    {issue.firstAt && ` · first ${fmtDateTime(issue.firstAt)}`}
                    {issue.lastAt && ` · last ${fmtDateTime(issue.lastAt)}`}
                  </>
                )}
          </p>

          {issue.lastMessage && (
            <p className="mt-2.5 break-words rounded-[10px] border border-hair bg-surface2 px-3 py-2 font-mono text-[11.5px] leading-[1.5] text-faint">
              {issue.lastMessage}
            </p>
          )}
        </div>

        <div className="col-start-2 flex flex-wrap items-start gap-2 sm:col-start-3 sm:flex-col sm:items-end">
          {issue.fix && <FixLink fix={issue.fix} />}
          <button type="button" onClick={() => onShowSignals(issue)} className={FIX_BTN}>
            <ListFilter size={13} aria-hidden="true" />
            See the signals
          </button>
        </div>
      </div>
    </article>
  )
}

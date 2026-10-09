import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Moon, RefreshCw } from 'lucide-react'
import FixLink from './FixLink'
import { getApiErrorMessage } from '../../../services/api'
import { fmtAgo, fmtDateTime } from '../../../lib/format'
import { issueWhoShort, plural } from '../../../lib/signalHealth'
import type { SignalHealth, SignalHealthStatus } from '../../../types/tradeLogs'

/** Top issues the banner lists before "See all issues". */
const BANNER_ISSUES = 3

const STRIP: Record<SignalHealthStatus | 'pending', string> = {
  healthy:
    'border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)]',
  normal: 'border-border bg-surface',
  attention:
    'border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)]',
  quiet: 'border-dashed border-border bg-surface2',
  pending: 'border-border bg-surface',
}

const ICON_BOX = 'relative grid h-9 w-9 flex-none place-items-center rounded-[10px]'

const ICON: Record<SignalHealthStatus, ReactNode> = {
  healthy: (
    <span className={`${ICON_BOX} bg-green/15 text-green`}>
      <CheckCircle2 size={18} aria-hidden="true" />
    </span>
  ),
  normal: (
    <span className={`${ICON_BOX} border border-border bg-surface2 text-muted`}>
      <Info size={18} aria-hidden="true" />
    </span>
  ),
  attention: (
    <span className={`${ICON_BOX} bg-red text-white`}>
      <AlertTriangle size={17} aria-hidden="true" />
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-red ring-2 ring-surface" />
    </span>
  ),
  quiet: (
    <span className={`${ICON_BOX} border border-border bg-surface text-faint`}>
      <Moon size={17} aria-hidden="true" />
    </span>
  ),
}

const HEADLINE = 'text-[14px] font-semibold leading-[1.45] text-text'
const SUB = 'mt-1 text-[12.5px] leading-[1.55] text-muted'
const META = 'mt-1 text-[12px] leading-[1.5] text-faint'

/**
 * "Is the trading logic healthy right now?" — the last 24 h of signals,
 * whatever the page below is filtered to. Normal skips (nothing to close, a
 * full stack) are how the strategy works and read calm; only problems — a
 * refused key, a refused order, a master that missed a signal — turn it red,
 * with the top causes and where to fix them.
 */
export default function HealthBanner({
  data,
  loading,
  error,
  onRetry,
  onSeeIssues,
}: {
  data: SignalHealth | null
  loading: boolean
  error: unknown
  onRetry: () => void
  onSeeIssues: () => void
}) {
  if (!data) {
    return (
      <section
        className={`mb-stack rounded-row border px-4 py-3.5 ${STRIP.pending}`}
        aria-live="polite"
      >
        {loading ? (
          <p className="flex items-center gap-2.5 text-[13px] text-muted">
            <span className="h-4 w-4 flex-none rounded-full border-2 border-border border-t-accent animate-[dstate-spin_0.8s_linear_infinite]" />
            Checking how the last signals went…
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
            <p className="min-w-0 text-[13px] text-muted">
              {getApiErrorMessage(error, 'Could not check how the last signals went.')}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex flex-none items-center gap-1.5 rounded-btn border border-border bg-surface2 px-3 py-[6px] text-[12px] font-semibold text-text hover:border-accent"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Try again
            </button>
          </div>
        )}
      </section>
    )
  }

  const { status, hours } = data
  const lastSignal = data.lastSignalAt ? `last signal ${fmtAgo(data.lastSignalAt)}` : null
  const meta = [
    plural(data.signals, 'signal', 'signals'),
    `${plural(data.filled, 'order', 'orders')} filled`,
    lastSignal,
  ]
    .filter(Boolean)
    .join(' · ')

  // Keyed fade rather than data-aos: React reuses the loading <section> node,
  // and AOS only picks up nodes ADDED after init — an attribute appearing on a
  // reused node would leave the banner stuck at opacity 0.
  return (
    <section
      key={status}
      className={`mb-stack rounded-row border px-4 py-3.5 animate-[fadeup_0.35s_ease-out] ${STRIP[status]}`}
      aria-live="polite"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3">
        {ICON[status]}
        <div className="min-w-0 pt-px">
          {status === 'healthy' && (
            <>
              <p className={HEADLINE}>
                All good — every account filled on the last{' '}
                {data.signals === 1 ? 'signal' : `${data.signals} signals`} ({hours} h).
              </p>
              <p className={META}>{meta}</p>
            </>
          )}

          {status === 'normal' && (
            <>
              <p className={HEADLINE}>
                Working as expected — {plural(data.normalSkips, 'normal skip', 'normal skips')} in
                the last {hours} h.
              </p>
              <p className={SUB}>
                Skips like &ldquo;nothing to close&rdquo; or &ldquo;stack already full&rdquo; are how
                the strategy works. No action needed.
              </p>
              <p className={META}>{meta}</p>
            </>
          )}

          {status === 'attention' && (
            <AttentionBody data={data} meta={meta} onSeeIssues={onSeeIssues} />
          )}

          {status === 'quiet' && (
            <>
              <p className={HEADLINE}>
                No signals in the last {hours} hours
                {data.lastSignalAt && (
                  <span className="font-normal text-muted">
                    {' '}
                    — last one {fmtDateTime(data.lastSignalAt)}
                  </span>
                )}
              </p>
              <p className={SUB}>
                Normal on a slow market. If you expected a trade, check that the TradingView alerts
                are still on and the{' '}
                <Link to="/admin/engine" className="font-semibold text-text underline-offset-2 hover:underline">
                  bot engine
                </Link>{' '}
                is running.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function AttentionBody({
  data,
  meta,
  onSeeIssues,
}: {
  data: SignalHealth
  meta: string
  onSeeIssues: () => void
}) {
  const { problems, masterMissed, hours } = data
  const top = data.issues.slice(0, BANNER_ISSUES)

  return (
    <>
      <p className={HEADLINE}>
        Needs attention —{' '}
        {problems > 0
          ? `${plural(problems, 'account problem', 'account problems')} in the last ${hours} h`
          : `in the last ${hours} h`}
        {masterMissed > 0 && (
          <span className="text-red">
            {' '}
            · the master missed {plural(masterMissed, 'signal', 'signals')}
          </span>
        )}
      </p>
      <p className={META}>{meta}</p>

      {top.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {top.map((issue) => (
            <li
              key={issue.key}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[10px] border border-[color-mix(in_srgb,var(--red)_22%,transparent)] bg-surface/70 px-3 py-2.5"
            >
              <p className="min-w-0 break-words text-[12.5px] leading-[1.5]">
                <span className="font-semibold text-text">{issueWhoShort(issue)}</span>
                <span className="text-faint"> · </span>
                <span className="font-semibold text-red">{issue.label}</span>
                <span className="text-faint"> · </span>
                <span className="font-mono text-muted">{issue.count}×</span>
                {issue.lastAt && (
                  <span className="text-faint"> · last {fmtAgo(issue.lastAt)}</span>
                )}
              </p>
              {issue.fix && <FixLink fix={issue.fix} />}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onSeeIssues}
        className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-red hover:underline"
      >
        {data.issuesTotal > top.length ? `See all ${data.issuesTotal} issues` : 'See all issues'}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </>
  )
}

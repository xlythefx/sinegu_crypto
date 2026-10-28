import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  HelpCircle,
  Monitor,
  ShieldAlert,
  Smartphone,
  Tablet,
  type LucideIcon,
} from 'lucide-react'
import { countryName, deviceTypeLabel } from '../../../lib/accessEvents'
import { fmtDateTimeSeconds, fmtDateTimeYear } from '../../../lib/format'
import { visitPageLabel } from '../../../lib/visitPages'
import { SUSPICIOUS_REASON_LABELS } from '../../../lib/visitorLabels'
import type { VisitorAccount, VisitorDevice, VisitorIpDetail, VisitorLog as VisitorLogData, VisitorLogRow } from '../../../types/visitors'

const PAG_BTN =
  'grid place-items-center w-8 h-8 border border-border bg-surface2 text-text rounded-[9px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

/** Desktop columns: when · page · IP · device · came from & notes. Stacks below md. */
const COLS =
  'grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-[132px_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] md:items-start md:gap-x-4'

const TH = 'font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint'

const TAG = 'inline-flex items-center gap-1 rounded-pill border px-2 py-[1px] text-[11px] font-semibold leading-[1.5]'
const TAG_NEUTRAL = `${TAG} border-hair bg-surface2 text-muted`
const TAG_RED = `${TAG} border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-red`
const TAG_ACCENT = `${TAG} border-accent-line bg-accent-soft text-accent`

const DEVICE_ICONS: Record<VisitorDevice, LucideIcon> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
}

function Accounts({ accounts, lead }: { accounts: VisitorAccount[]; lead: string }) {
  if (accounts.length === 0) return null
  return (
    <span className="text-[12px] text-muted">
      {lead}{' '}
      {accounts.map((a, i) => (
        <span key={a.uni_id}>
          {i > 0 && ', '}
          <Link to={`/admin/users/${a.uni_id}`} className="font-semibold text-text hover:text-accent">
            {a.name ?? 'a user'}
          </Link>
        </span>
      ))}
    </span>
  )
}

function Row({ row, onIp }: { row: VisitorLogRow; onIp: (ip: string) => void }) {
  const Icon = DEVICE_ICONS[row.device_type] ?? HelpCircle
  const system = [row.browser, row.os].filter(Boolean).join(' · ')
  const from = [
    row.source && row.source !== 'Direct' ? `From ${row.source}` : row.source,
    row.ref_code && `Invite ${row.ref_code}`,
    (row.utm_campaign || row.utm_source) && `Campaign ${row.utm_campaign ?? row.utm_source}`,
  ].filter(Boolean)

  return (
    <li className={`${COLS} py-3 text-[12.5px] ${row.suspicious ? 'opacity-80' : ''}`}>
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[12px]">{fmtDateTimeSeconds(row.at)}</span>
        {row.entry && <span className={`${TAG_NEUTRAL} self-start`}>First page</span>}
      </div>

      <div className="font-semibold">{visitPageLabel(row.path)}</div>

      <div className="flex flex-col gap-1">
        {row.ip ? (
          <button
            type="button"
            onClick={() => onIp(row.ip as string)}
            title="Show every visit from this address"
            className="self-start break-all text-left font-mono text-[12.5px] font-semibold text-text underline decoration-border underline-offset-2 hover:text-accent hover:decoration-accent"
          >
            {row.ip}
          </button>
        ) : (
          <span className="text-[12px] text-faint">IP deleted after 90 days</span>
        )}
        {row.country && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
            <span className="rounded-[5px] border border-border px-1 font-mono text-[10.5px]">{row.country}</span>
            {countryName(row.country)}
          </span>
        )}
      </div>

      <div className="flex items-start gap-1.5">
        <Icon size={14} className="mt-[2px] flex-none text-muted" aria-hidden="true" />
        <span>
          {deviceTypeLabel(row.device_type)}
          {system && <span className="block text-[12px] text-muted">{system}</span>}
        </span>
      </div>

      <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
        {(from.length > 0 || row.suspicious || row.signed_in) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {from.length > 0 && <span className="text-[12.5px]">{from.join(' · ')}</span>}
            {row.suspicious && (
              <span className={TAG_RED}>
                <ShieldAlert size={11} aria-hidden="true" />
                {row.suspicious_reason ? SUSPICIOUS_REASON_LABELS[row.suspicious_reason] : 'Suspicious'}
              </span>
            )}
            {row.signed_in && <span className={TAG_ACCENT}>Signed-in customer</span>}
          </div>
        )}
        <Accounts accounts={row.accounts} lead="Accounts from this IP:" />
      </div>
    </li>
  )
}

/** The strip above the log when it is narrowed to one address. */
function IpDetail({ detail }: { detail: VisitorIpDetail }) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-row border border-accent-line bg-accent-soft px-4 py-3 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-bold">
          <Fingerprint size={14} className="text-accent" aria-hidden="true" />
          {detail.ip}
        </span>
        <span className="text-muted">
          {detail.views.toLocaleString()} {detail.views === 1 ? 'page view' : 'page views'} kept
          {detail.suspicious_views > 0 && ` (${detail.suspicious_views} suspicious)`}
        </span>
        {detail.first_seen && detail.last_seen && (
          <span className="text-muted">
            {fmtDateTimeYear(detail.first_seen)} – {fmtDateTimeYear(detail.last_seen)}
          </span>
        )}
        {detail.countries.length > 0 && (
          <span className="text-muted">{detail.countries.map((c) => countryName(c) ?? c).join(', ')}</span>
        )}
      </div>
      {detail.accounts.length > 0 ? (
        <Accounts accounts={detail.accounts} lead="Signed up or signed in from this address:" />
      ) : (
        <span className="text-[12px] text-muted">No account has signed up or signed in from this address.</span>
      )}
    </div>
  )
}

/**
 * One page of the visitor log, newest first. The parent re-keys it on every
 * filter and page change (the reveal convention). Clicking an IP narrows the
 * log to that address and shows which accounts used it.
 */
export default function VisitorLog({
  data,
  page,
  perPage,
  onPage,
  onIp,
  anyFilterActive,
  onClear,
}: {
  data: VisitorLogData
  page: number
  perPage: number
  onPage: (page: number) => void
  onIp: (ip: string) => void
  anyFilterActive: boolean
  onClear: () => void
}) {
  const { rows, pagination } = data
  const total = pagination.total
  const offset = (page - 1) * perPage
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <>
      {data.ip_detail && <IpDetail detail={data.ip_detail} />}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-[34px] text-center">
          <p className="text-[13px] text-muted">
            {anyFilterActive
              ? 'No visits match these filters.'
              : 'No visits in this period yet. A row appears here for every page someone reads on the public website.'}
          </p>
          {anyFilterActive && (
            <button type="button" onClick={onClear} className="text-[12.5px] font-semibold text-accent hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={`${COLS} hidden border-b border-hair pb-2.5 md:grid`} aria-hidden="true">
            <span className={TH}>When</span>
            <span className={TH}>Page</span>
            <span className={TH}>IP · country</span>
            <span className={TH}>Device</span>
            <span className={TH}>Came from</span>
          </div>
          <ul className="flex flex-col divide-y divide-hair">
            {rows.map((row) => (
              <Row key={row.id} row={row} onIp={onIp} />
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-hair pt-3.5">
            <span className="text-[12px] text-faint">
              Showing {offset + 1}–{Math.min(offset + rows.length, total)} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className={PAG_BTN}
                onClick={() => onPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-[12.5px] text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={PAG_BTN}
                onClick={() => onPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

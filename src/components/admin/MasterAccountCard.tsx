import { Shield } from 'lucide-react'
import { fmtDateTime, fmtMoney, fmtSignedMoney } from '../../lib/format'
import type { MasterStats } from '../../types/admin'

interface MasterAccountCardProps {
  master: MasterStats['master']
  stats: MasterStats['stats']
}

const badgeBase =
  'inline-flex items-center whitespace-nowrap rounded-pill border border-border py-[3px] px-[9px] text-[11px] font-semibold text-muted'

/** Master account summary: badges, masked credentials, last trade. */
export default function MasterAccountCard({
  master,
  stats,
}: MasterAccountCardProps) {
  const account = master.account

  return (
    <section
      className="rounded-card border border-border bg-surface p-card max-w-[440px] max-[1100px]:max-w-none grow basis-[340px] self-start"
      data-aos="fade-up"
    >
      <div className="flex items-center gap-2.5 mb-[14px]">
        <span className="w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none">
          <Shield size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold text-accent">
            Master Account
          </div>
          <div className="text-[12px] text-muted mt-px">
            Primary live account feeding platform performance.
          </div>
        </div>
      </div>

      <div className="mb-[14px] flex flex-wrap gap-1.5">
        <span className={badgeBase}>ID: {account?.id ?? '—'}</span>
        <span className={`${badgeBase} bg-surface2 text-text`}>
          {master.name}
        </span>
        <span className={`${badgeBase} border-accent-line bg-accent-soft text-accent`}>
          {account?.demo ? 'Demo' : 'Live'}
        </span>
        <span className={`${badgeBase} border-accent-line bg-accent-soft text-accent`}>
          {account?.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <div className="flex flex-col gap-2 text-[13px]">
        <p>
          <b className="font-semibold">Email:</b> {master.email}
        </p>
        <p>
          <b className="font-semibold">API Key:</b>{' '}
          <span className="font-mono text-[12.5px]">
            {account?.api_key ?? 'Not connected'}
          </span>
        </p>
        <p>
          <b className="font-semibold">Balance:</b>{' '}
          <span className="font-mono text-[12.5px]">
            {stats.balance === null ? (
              <span className="text-faint">Awaiting sync</span>
            ) : (
              `${fmtMoney(stats.balance)} ${account?.currency_type ?? 'USDT'}`
            )}
          </span>
        </p>
        <p>
          <b className="font-semibold">Unrealized P&L:</b>{' '}
          <span
            className={`font-mono text-[12.5px] ${
              stats.unrealized_pnl < 0 ? 'text-red' : 'text-green'
            }`}
          >
            {fmtSignedMoney(stats.unrealized_pnl)}
          </span>
        </p>
      </div>

      <div className="mt-[14px] flex flex-col gap-1 rounded-field border border-hair bg-surface2 py-3 px-[14px] text-[12.5px]">
        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted">
          Last Trade
        </span>
        <span className="font-mono">
          {stats.last_trade_at ? fmtDateTime(stats.last_trade_at) : 'No trades yet'}
        </span>
      </div>
    </section>
  )
}

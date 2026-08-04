import { Building2 } from 'lucide-react'
import { BADGE } from '../badges'
import { EXCHANGE_META } from '../../exchanges/meta'
import { fmtMoney, fmtSignedMoney } from '../../../lib/format'
import type { AdminUserDetailAccount } from '../../../types/admin'
import type { ExchangeKind } from '../../../types/exchanges'
import type { ExchangePillValue } from './ExchangeFilterPill'

const MINI_TILE = 'rounded-row border border-hair bg-surface px-2.5 py-2'
const MINI_LABEL =
  'text-[10px] font-extrabold uppercase tracking-[0.5px] text-faint'
const MINI_VALUE = 'mt-0.5 font-mono text-[13px] font-bold'

interface UserAccountCardsProps {
  accounts: AdminUserDetailAccount[]
  exchange: ExchangePillValue
}

function exchangeColor(exchange: string): string {
  const meta = EXCHANGE_META[exchange as ExchangeKind]
  return meta ? meta.color : 'var(--accent)'
}

function exchangeLabel(exchange: string): string {
  const meta = EXCHANGE_META[exchange as ExchangeKind]
  return meta ? meta.label : exchange
}

/**
 * Exchange accounts section card (all accounts — demo / disabled /
 * disconnected included, each badged). Shaped like UserPerformanceMetrics /
 * UserCapitalFlow so the three share one row on the overview tab.
 */
export default function UserAccountCards({
  accounts,
  exchange,
}: UserAccountCardsProps) {
  const filtered =
    exchange === 'all' ? accounts : accounts.filter((a) => a.exchange === exchange)

  return (
    <section className="flex flex-col rounded-card border border-border bg-surface p-card">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Building2 size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Exchange Accounts
          </div>
          <div className="mt-px text-[12px] text-muted">
            {filtered.length} account{filtered.length === 1 ? '' : 's'}
            {exchange !== 'all' ? ` · ${exchangeLabel(exchange)}` : ''}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5">
        {filtered.map((a) => (
          <div
            key={a.id}
            className={`rounded-row border border-hair bg-surface2 p-3.5 ${
              a.deleted_at ? 'opacity-[.65]' : ''
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span
                className="mt-[5px] h-2 w-2 flex-none rounded-full"
                style={{ background: exchangeColor(a.exchange) }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[7px] font-bold text-[13.5px]">
                  <Building2 size={13} className="flex-none text-muted" />
                  <span className="truncate">{a.name}</span>
                </div>
                <div className="mt-0.5 truncate font-mono text-[11.5px] text-faint">
                  {exchangeLabel(a.exchange)} · {a.api_key ?? '—'}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={`${BADGE} bg-surface border-border text-muted`}>
                {a.demo ? 'Demo' : 'Live'}
              </span>
              <span className={`${BADGE} bg-surface border-border text-muted`}>
                {a.enabled ? 'Enabled' : 'Disabled'}
              </span>
              {a.deleted_at && (
                <span
                  className={`${BADGE} bg-[color-mix(in_srgb,var(--red)_10%,transparent)] border-[color-mix(in_srgb,var(--red)_35%,transparent)] text-red`}
                >
                  Disconnected
                </span>
              )}
            </div>

            <div className="mt-3.5 border-t border-hair pt-3.5">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.5px] text-faint">
                Balance
              </div>
              <div className="mt-0.5 font-mono text-[20px] font-extrabold">
                {fmtMoney(a.balance)}{' '}
                <span className="text-[12px] font-semibold text-muted">
                  {a.currency_type ?? 'USDT'}
                </span>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className={MINI_TILE}>
                <div className={MINI_LABEL}>Realized P&L</div>
                <div
                  className={`${MINI_VALUE} ${a.realized_pnl < 0 ? 'text-red' : 'text-green'}`}
                >
                  {fmtSignedMoney(a.realized_pnl)}
                </div>
              </div>
              <div className={MINI_TILE}>
                <div className={MINI_LABEL}>Unrealized P&L</div>
                <div
                  className={`${MINI_VALUE} ${a.unrealized_pnl < 0 ? 'text-red' : 'text-green'}`}
                >
                  {fmtSignedMoney(a.unrealized_pnl)}
                </div>
              </div>
              <div className={MINI_TILE}>
                <div className={MINI_LABEL}>Initial deposit</div>
                <div className={MINI_VALUE}>{fmtMoney(a.initial_deposit)}</div>
              </div>
              <div className={MINI_TILE}>
                <div className={MINI_LABEL}>High-water mark</div>
                <div className={MINI_VALUE}>
                  {a.hwm === null ? '—' : fmtMoney(a.hwm)}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="grid min-h-[140px] flex-1 place-items-center rounded-row border border-dashed border-border bg-surface2 px-4 py-8 text-center text-[13px] text-muted">
            No {exchange === 'all' ? 'exchange' : exchangeLabel(exchange)}{' '}
            accounts connected yet.
          </div>
        )}
      </div>
    </section>
  )
}

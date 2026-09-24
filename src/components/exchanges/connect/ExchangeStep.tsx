import { Check, Lock, Plus } from 'lucide-react'
import type { UserRole } from '../../../types/auth'
import type { ExchangeKind } from '../../../types/exchanges'
import { EXCHANGE_META, EXCHANGE_ORDER, canConnectExchange } from '../meta'
import { OPTION, OPTION_PILL } from './classes'

interface ExchangeStepProps {
  selected: ExchangeKind | null
  /** Exchanges the user already holds an account on — one account per exchange. */
  connectedKinds: ExchangeKind[]
  /** Decides whether a staff-only venue is offered; the API enforces it. */
  role: UserRole | undefined
  onSelect: (kind: ExchangeKind) => void
}

/** Brand square with the exchange's initial. */
function Mark({ kind, dim }: { kind: ExchangeKind; dim?: boolean }) {
  const meta = EXCHANGE_META[kind]
  return (
    <span
      className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-row border font-display text-[20px] font-extrabold"
      style={{
        color: meta.color,
        background: `color-mix(in srgb, ${meta.color} ${dim ? 10 : 14}%, transparent)`,
        borderColor: `color-mix(in srgb, ${meta.color} ${dim ? 22 : 35}%, transparent)`,
      }}
    >
      {meta.label[0]}
    </span>
  )
}

/**
 * Step 1 — which exchange. Binance connects for everyone; MEXC and Bybit are
 * locked to staff while they are still being proven. Both read "Coming soon"
 * to a customer, which is the truth they need — showing the venues is the
 * roadmap, hiding them would read as "never". A venue the user already holds
 * an account on is locked too — one account per exchange.
 */
export default function ExchangeStep({
  selected,
  connectedKinds,
  role,
  onSelect,
}: ExchangeStepProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {EXCHANGE_ORDER.map((kind) => {
        const meta = EXCHANGE_META[kind]
        const connected = connectedKinds.includes(kind)
        const restricted = !canConnectExchange(kind, role)
        const locked = restricted || connected
        const active = selected === kind

        if (locked) {
          return (
            <div
              key={kind}
              className={`${OPTION} cursor-not-allowed border-border opacity-60`}
              aria-disabled="true"
            >
              <Mark kind={kind} dim />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[14px] font-bold text-text">
                  {meta.label}
                </span>
                <span className="text-[12px] leading-[1.5] text-muted">
                  {connected
                    ? 'Already connected — disconnect it first to connect different keys'
                    : meta.blurb}
                </span>
              </span>
              {connected ? (
                <span
                  className={`${OPTION_PILL} border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] text-green`}
                >
                  <Check size={11} />
                  Connected
                </span>
              ) : (
                <span className={`${OPTION_PILL} border-border bg-surface text-muted`}>
                  <Lock size={11} />
                  Coming soon
                </span>
              )}
            </div>
          )
        }

        return (
          <button
            key={kind}
            type="button"
            className={`${OPTION} cursor-pointer hover:-translate-y-px hover:border-accent-line hover:bg-accent-soft ${
              active ? 'border-accent bg-accent-soft' : 'border-border'
            }`}
            onClick={() => onSelect(kind)}
            aria-pressed={active}
          >
            <Mark kind={kind} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-bold text-text">{meta.label}</span>
                {/* Only staff ever see this row at all — the badge says why,
                    so nobody mistakes an internal venue for a public one. */}
                {meta.staffOnly && (
                  <span className={`${OPTION_PILL} border-accent-line bg-accent-soft text-accent`}>
                    Staff only
                  </span>
                )}
              </span>
              <span className="text-[12px] leading-[1.5] text-muted">
                {meta.staffOnly
                  ? 'Not offered to customers yet — connecting is limited to the team.'
                  : meta.blurb}
              </span>
            </span>
            <span
              className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full ${
                active ? 'bg-accent text-on-accent' : 'bg-accent-soft text-accent'
              }`}
            >
              {active ? <Check size={15} /> : <Plus size={15} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

import { KeyRound, PlugZap, PowerOff, ShieldAlert } from 'lucide-react'
import type { AdminApiKeyCounts } from '../../types/admin'

const STAT_ICON =
  'w-10 h-10 flex-shrink-0 grid place-items-center rounded-[11px] bg-surface2 border border-border'
const CARD =
  'rounded-card border border-border bg-surface p-card flex items-center gap-[13px]'
const LABEL = 'text-[10.5px] uppercase tracking-[0.07em] text-faint mb-[3px]'
const VALUE = 'text-[19px] font-bold text-text leading-[1.1] font-mono tabular-nums'
const SUB = 'text-[11px] text-faint mt-[3px]'

interface ApiKeyStatCardsProps {
  counts: AdminApiKeyCounts
  /** Days a refused key may sit before it is disconnected automatically. */
  graceDays: number
}

/**
 * The 4 headline cards. Every figure comes from the server's `counts`, so a
 * card can never disagree with the filter chip of the same name.
 *
 * The faulty card turns red the moment there is one — it is the number that
 * means someone's account has silently stopped trading, so it is not allowed
 * to look like the others.
 */
export default function ApiKeyStatCards({
  counts,
  graceDays,
}: ApiKeyStatCardsProps) {
  const hasFaults = counts.faulty > 0

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] mb-[18px]"
      data-aos="fade-up"
    >
      <div className={CARD}>
        <span className={`${STAT_ICON} text-accent`}>
          <KeyRound size={18} />
        </span>
        <div>
          <p className={LABEL}>Connected keys</p>
          <p className={VALUE}>{counts.connected}</p>
          <p className={SUB}>{counts.all} ever connected</p>
        </div>
      </div>

      <div
        className={
          hasFaults
            ? 'rounded-card border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_7%,transparent)] p-card flex items-center gap-[13px]'
            : CARD
        }
      >
        <span
          className={`${
            hasFaults
              ? 'w-10 h-10 flex-shrink-0 grid place-items-center rounded-[11px] bg-[color-mix(in_srgb,var(--red)_15%,transparent)] border border-[color-mix(in_srgb,var(--red)_35%,transparent)]'
              : STAT_ICON
          } text-red`}
        >
          <ShieldAlert size={18} />
        </span>
        <div>
          <p className={LABEL}>Not working</p>
          <p className={`${VALUE} ${hasFaults ? 'text-red' : ''}`}>
            {counts.faulty}
          </p>
          <p className={SUB}>
            {hasFaults
              ? `refused by the exchange · ${graceDays}-day grace`
              : 'every key is being accepted'}
          </p>
        </div>
      </div>

      <div className={CARD}>
        <span className={`${STAT_ICON} text-muted`}>
          <PowerOff size={18} />
        </span>
        <div>
          <p className={LABEL}>Disabled</p>
          <p className={VALUE}>{counts.disabled}</p>
          <p className={SUB}>connected but skipped by the engine</p>
        </div>
      </div>

      <div className={CARD}>
        <span className={`${STAT_ICON} text-muted`}>
          <PlugZap size={18} />
        </span>
        <div>
          <p className={LABEL}>Disconnected</p>
          <p className={VALUE}>{counts.disconnected}</p>
          <p className={SUB}>
            {counts.sandbox > 0
              ? `${counts.sandbox} sandbox key${counts.sandbox > 1 ? 's' : ''} in total`
              : 'history kept, no longer trading'}
          </p>
        </div>
      </div>
    </div>
  )
}

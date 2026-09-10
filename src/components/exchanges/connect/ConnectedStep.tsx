import { Link } from 'react-router-dom'
import { CheckCircle2, LayoutDashboard, Wallet } from 'lucide-react'
import type { ExchangeAccount } from '../../../types/exchanges'
import { GHOST_BTN, PRIMARY_BTN } from './classes'

interface ConnectedStepProps {
  account: ExchangeAccount
  /** The API revived a key this user had disconnected before. */
  reconnected?: boolean
}

const NEXT_STEPS = [
  'Your balance appears within a few minutes, once the first sync runs — “Awaiting sync” until then.',
  'The bot trades this account from the next signal. You do not have to do anything else.',
  'Positions show up under Positions, and every fill is listed there as it happens.',
]

/**
 * Terminal state of the wizard. It exists to answer the question the moment
 * after connecting always raises — "is it working? why is my balance $0?" —
 * before the user goes looking for a problem that is just the poller's next tick.
 */
export default function ConnectedStep({
  account,
  reconnected,
}: ConnectedStepProps) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="grid h-[68px] w-[68px] place-items-center rounded-[20px] border border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_12%,transparent)] text-green">
        <CheckCircle2 size={32} />
      </span>

      <h2 className="mt-4 font-display text-[21px] font-extrabold tracking-[-0.02em] text-text">
        {account.name} is {reconnected ? 'reconnected' : 'connected'}
      </h2>

      {/* Say it plainly: the old numbers are back, nothing was lost or reset. */}
      {reconnected && (
        <p className="mt-2 max-w-[440px] rounded-field border border-accent-line bg-accent-soft px-3.5 py-2 text-[12.5px] leading-[1.55] text-text">
          You had connected this key before, so your past trades and billing
          history came back with it.
        </p>
      )}
      <p className="mt-1.5 max-w-[440px] text-[13px] leading-[1.6] text-muted">
        {account.demo
          ? 'This account trades the Binance futures testnet with play money — a safe way to watch the strategy work before committing real funds.'
          : 'The bot will trade this account on Binance futures from the next signal.'}
      </p>

      <ul className="mt-5 flex w-full max-w-[460px] flex-col gap-2.5 text-left">
        {NEXT_STEPS.map((step) => (
          <li
            key={step}
            className="flex items-start gap-2.5 rounded-field border border-border bg-surface2 px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-muted"
          >
            <span
              className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-accent"
              aria-hidden="true"
            />
            {step}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
        <Link className={GHOST_BTN} to="/dashboard">
          <LayoutDashboard size={15} />
          Go to dashboard
        </Link>
        <Link className={PRIMARY_BTN} to="/dashboard/exchanges">
          <Wallet size={15} />
          View my account
        </Link>
      </div>
    </div>
  )
}

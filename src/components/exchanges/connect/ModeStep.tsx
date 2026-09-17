import { Check, FlaskConical, Info, Wallet } from 'lucide-react'
import type { ExchangeKind } from '../../../types/exchanges'
import { EXCHANGE_COPY } from '../exchangeCopy'
import { EXCHANGE_META } from '../meta'
import { OPTION } from './classes'

interface ModeStepProps {
  kind: ExchangeKind
  /** true = the exchange's futures testnet, false = real mainnet trading. */
  demo: boolean | null
  onSelect: (demo: boolean) => void
}

interface ModeOption {
  demo: boolean
  icon: typeof Wallet
  title: string
  tagline: string
  points: string[]
  /** Brand color role — live is the accent, demo is deliberately neutral. */
  accent: boolean
}

/**
 * The two networks, described by what they cost and what they prove. Both
 * bullet lists answer the same three questions in the same order — whose money,
 * where the keys come from, whether it is billed — so the columns can be read
 * across rather than each on its own.
 */
function modesFor(kind: ExchangeKind): ModeOption[] {
  const copy = EXCHANGE_COPY[kind]
  const site = new URL(copy.liveKeysUrl).hostname.replace(/^www\./, '')
  return [
    {
      demo: false,
      icon: Wallet,
      title: 'Live account',
      tagline: `Trades your real ${copy.marketName} balance.`,
      points: [
        'Real funds, real profit and loss',
        `Keys from ${site} → API Management`,
        'Billed 20% of profit only — never on a losing month',
      ],
      accent: true,
    },
    {
      demo: true,
      icon: FlaskConical,
      title: 'Demo account',
      tagline: `Trades the ${copy.marketName} testnet with play money.`,
      points: [
        'Test funds only — nothing you own is at risk',
        copy.demoKeysPoint ?? `Keys from ${copy.demoSite}`,
        'Never invoiced — results are not real performance',
      ],
      accent: false,
    },
  ]
}

/**
 * Step 2 — live or demo. This writes the account's `demo` flag, which the
 * engine reads to pick the API host for every call on this account, so it is
 * not a display preference: the wrong choice fails silently in opposite
 * directions — a live key pointed at the testnet never trades, a testnet key
 * on mainnet is refused — which is why the step names the site each key set
 * comes from. Only shown for venues with a testnet (EXCHANGE_META.hasTestnet).
 */
export default function ModeStep({ kind, demo, onSelect }: ModeStepProps) {
  const MODES = modesFor(kind)
  const label = EXCHANGE_META[kind].label
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 min-[820px]:grid-cols-2">
        {MODES.map((mode) => {
          const active = demo === mode.demo
          const Icon = mode.icon
          return (
            <button
              key={mode.title}
              type="button"
              className={`${OPTION} cursor-pointer flex-col gap-3 hover:-translate-y-px hover:border-accent-line ${
                active
                  ? 'border-accent bg-accent-soft'
                  : 'border-border hover:bg-accent-soft'
              }`}
              onClick={() => onSelect(mode.demo)}
              aria-pressed={active}
            >
              <span className="flex w-full items-start gap-3">
                <span
                  className={`grid h-[42px] w-[42px] flex-none place-items-center rounded-row border ${
                    mode.accent
                      ? 'border-accent-line bg-accent-soft text-accent'
                      : 'border-border bg-surface text-muted'
                  }`}
                >
                  <Icon size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-bold text-text">
                    {mode.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-[1.5] text-muted">
                    {mode.tagline}
                  </span>
                </span>
                <span
                  className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full border ${
                    active
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-border bg-surface'
                  }`}
                  aria-hidden="true"
                >
                  {active && <Check size={13} />}
                </span>
              </span>

              <ul className="flex w-full flex-col gap-1.5">
                {mode.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-[12px] leading-[1.5] text-muted"
                  >
                    <span
                      className={`mt-[6px] h-1.5 w-1.5 flex-none rounded-full ${
                        mode.accent ? 'bg-accent' : 'bg-faint'
                      }`}
                      aria-hidden="true"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      <p className="flex items-start gap-2 rounded-field border border-border bg-surface2 px-3.5 py-2.5 text-[12px] leading-[1.55] text-muted">
        <Info size={14} className="mt-px flex-none text-accent" />
        You can hold one {label} account at a time. Starting on demo is fine —
        disconnect it whenever you want and connect live keys instead.
      </p>
    </div>
  )
}

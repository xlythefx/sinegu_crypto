import { FlaskConical, Wallet, Zap } from 'lucide-react'
import type { ExchangeKind } from '../../../types/exchanges'
import { EXCHANGE_META } from '../meta'
import { LABEL } from './classes'
import type { KeysForm } from './KeysStep'

interface ReviewStepProps {
  kind: ExchangeKind
  demo: boolean
  form: KeysForm
}

/** Show enough of a key to recognise it, never enough to use it. */
function maskKey(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 12) return `${trimmed.slice(0, 4)}••••`
  return `${trimmed.slice(0, 6)}••••••${trimmed.slice(-4)}`
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-hair py-3 last:border-b-0">
      <span className={LABEL}>{label}</span>
      <span className="min-w-0 text-[13px] font-semibold text-text">
        {children}
      </span>
    </div>
  )
}

/**
 * Step 4 — one last look before real keys start trading real money. The mode
 * is repeated as a badge here because it is the only choice on this page the
 * user cannot see the consequence of until a signal fires.
 */
export default function ReviewStep({ kind, demo, form }: ReviewStepProps) {
  const meta = EXCHANGE_META[kind]

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`flex items-start gap-3 rounded-rail border p-4 ${
          demo
            ? 'border-border bg-surface2'
            : 'border-accent-line bg-accent-soft'
        }`}
      >
        <span
          className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-row border ${
            demo
              ? 'border-border bg-surface text-muted'
              : 'border-accent-line bg-surface text-accent'
          }`}
        >
          {demo ? <FlaskConical size={18} /> : <Wallet size={18} />}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-text">
            {demo ? 'Demo — Binance futures testnet' : 'Live — real funds'}
          </p>
          <p className="mt-0.5 text-[12px] leading-[1.55] text-muted">
            {demo
              ? 'Orders go to the testnet with play money. Nothing you own is at risk, and this account is never invoiced.'
              : 'From the next signal, the bot places real futures orders on this account. You are billed 20% of profit only.'}
          </p>
        </div>
      </div>

      <div className="rounded-rail border border-border bg-surface2 px-4">
        <Row label="Exchange">
          <span className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: meta.color }}
              aria-hidden="true"
            />
            {meta.label}
          </span>
        </Row>
        <Row label="Mode">{demo ? 'Demo (testnet)' : 'Live'}</Row>
        <Row label="Account name">
          <span className="break-words">{form.name.trim()}</span>
        </Row>
        <Row label="API key">
          <code className="break-all font-mono text-[12.5px]">
            {maskKey(form.api_key)}
          </code>
        </Row>
        <Row label="Secret key">
          <code className="font-mono text-[12.5px] text-muted">
            •••••••••••• stored, never shown
          </code>
        </Row>
      </div>

      <p className="flex items-start gap-2 text-[12px] leading-[1.55] text-muted">
        <Zap size={14} className="mt-px flex-none text-accent" />
        The account starts trading from the next signal — the engine is told
        about it immediately, not on a timer. You can disconnect at any time.
      </p>
    </div>
  )
}

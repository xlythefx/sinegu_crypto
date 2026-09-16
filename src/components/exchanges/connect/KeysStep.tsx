import { useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import type { ExchangeKind } from '../../../types/exchanges'
import { EXCHANGE_COPY } from '../exchangeCopy'
import { EXCHANGE_META } from '../meta'
import { INPUT, LABEL } from './classes'

export interface KeysForm {
  name: string
  api_key: string
  secret_key: string
}

interface KeysStepProps {
  kind: ExchangeKind
  demo: boolean
  form: KeysForm
  onChange: (form: KeysForm) => void
  /** Address the user must allow-list if they restrict the key by IP. */
  serverIp: string | null
}

/**
 * Step 3 — the credentials, with the instructions that produce them. The
 * instruction list is per exchange AND per mode because the key sets come
 * from different sites: the most common way to fail this step is pasting a
 * binance.com key into a demo account, or the reverse — and on MEXC, a key
 * that was never bound to our IP, which stops working after 90 days.
 */
export default function KeysStep({
  kind,
  demo,
  form,
  onChange,
  serverIp,
}: KeysStepProps) {
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = EXCHANGE_COPY[kind]
  const label = EXCHANGE_META[kind].label
  const ip = serverIp ?? null
  const steps = demo ? copy.demoSteps ?? [] : copy.liveSteps
  const keyUrl = demo ? copy.demoKeysUrl ?? copy.liveKeysUrl : copy.liveKeysUrl
  const keyLabel = demo ? copy.demoKeysLabel ?? copy.liveKeysLabel : copy.liveKeysLabel

  const copyIp = async () => {
    if (!ip) return
    try {
      await navigator.clipboard.writeText(ip)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the address is selectable in place */
    }
  }

  return (
    <div className="grid gap-5 min-[900px]:grid-cols-[minmax(0,1fr)_320px]">
      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Account name</span>
          <input
            type="text"
            className={INPUT}
            placeholder={demo ? 'e.g. Testnet' : `e.g. ${label} Main`}
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            maxLength={128}
            autoComplete="off"
          />
          <span className="text-[11.5px] text-faint">
            A label for you — it appears on your cards, invoices and trade log.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>API key</span>
          <input
            type="text"
            className={`${INPUT} font-mono text-[12.5px]`}
            placeholder={demo ? 'Testnet API key' : `${label} API key`}
            value={form.api_key}
            onChange={(e) => onChange({ ...form, api_key: e.target.value })}
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Secret key</span>
          <span className="relative flex">
            <input
              type={showSecret ? 'text' : 'password'}
              className={`${INPUT} pr-11 font-mono text-[12.5px]`}
              placeholder={demo ? 'Testnet secret key' : `${label} secret key`}
              value={form.secret_key}
              onChange={(e) => onChange({ ...form, secret_key: e.target.value })}
              maxLength={128}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-btn text-faint transition-colors duration-150 hover:bg-surface hover:text-text"
              onClick={() => setShowSecret((v) => !v)}
              aria-label={showSecret ? 'Hide secret key' : 'Show secret key'}
            >
              {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </span>
          <span className="text-[11.5px] text-faint">{copy.secretHint}</span>
        </label>

        <p className="flex items-start gap-2 text-[12px] leading-[1.5] text-muted">
          <ShieldCheck size={14} className="mt-px flex-none text-green" />
          Keys are stored on our server and used only to place and close trades.
          They are never shown back to you and never shared.
        </p>

        {!demo && copy.keyNote && (
          <p className="flex items-start gap-2 rounded-field border border-border bg-surface2 px-3.5 py-2.5 text-[12px] leading-[1.55] text-muted">
            <Info size={14} className="mt-px flex-none text-accent" />
            {copy.keyNote}
          </p>
        )}
      </form>

      <aside className="flex flex-col gap-3.5 rounded-rail border border-border bg-surface2 p-4">
        <div>
          <p className={LABEL}>
            {demo ? 'Where testnet keys come from' : 'How to create the key'}
          </p>
          <ol className="mt-2.5 flex list-decimal flex-col gap-2 pl-4 text-[12px] leading-[1.55] text-muted">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <a
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-accent hover:underline"
            href={keyUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {keyLabel}
            <ExternalLink size={12} />
          </a>
        </div>

        {!demo && (
          <div className="border-t border-hair pt-3.5">
            <p className={LABEL}>Our server IP</p>
            {ip ? (
              <>
                <div className="mt-2 flex items-center gap-2 rounded-field border border-accent-line bg-accent-soft px-3 py-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-[13.5px] font-bold tracking-[0.02em] text-text">
                    {ip}
                  </code>
                  <button
                    type="button"
                    className="inline-flex flex-none items-center gap-1.5 rounded-btn border border-border bg-surface px-2.5 py-1.5 text-[11.5px] font-bold text-text transition-[border-color] duration-150 hover:border-accent"
                    onClick={copyIp}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-[11.5px] leading-[1.5] text-faint">
                  {EXCHANGE_META[kind].hasTestnet
                    ? `Only needed if you tick “${copy.ipSettingName}”.`
                    : `Paste it under “${copy.ipSettingName}” — a bound key never expires.`}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[11.5px] leading-[1.5] text-faint">
                Leave the key unrestricted for now — if you restrict it by IP,
                we will show you the address to allow-list on the account card.
              </p>
            )}
          </div>
        )}

        <p className="flex items-start gap-2 border-t border-hair pt-3.5 text-[11.5px] leading-[1.5] text-muted">
          <TriangleAlert size={13} className="mt-px flex-none text-accent" />
          Never enable withdrawal permission on a key you share with any
          service, including us.
        </p>
      </aside>
    </div>
  )
}

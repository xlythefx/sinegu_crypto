import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Lock, Plus, ShieldCheck } from 'lucide-react'
import type { ExchangeAccount, ExchangeKind } from '../../types/exchanges'
import { EXCHANGE_META, EXCHANGE_ORDER } from './meta'
import { connectBinanceAccount } from '../../services/exchanges'
import { getApiErrorMessage } from '../../services/api'

interface ConnectExchangeWizardProps {
  open: boolean
  onClose: () => void
  /** Called after an account was created so the page can reload its list. */
  onConnected: (account: ExchangeAccount) => void
  /** Exchanges the user already has an account on — one account per exchange. */
  connectedKinds?: ExchangeKind[]
}

type Step = 'select' | 'binance'

const EMPTY_FORM = { name: '', api_key: '', secret_key: '' }

/** Uppercase mono field caption. */
const WIZ_LABEL =
  'font-mono text-[10px] font-semibold tracking-[0.12em] text-faint'

/** Credential text input. */
const WIZ_INPUT =
  'h-[42px] rounded-nav border border-border bg-surface2 px-3.5 text-[13px] text-text outline-none transition-colors duration-150 placeholder:text-faint focus:border-accent-line'

/** Rounded pill action button (Cancel / Back). */
const WIZ_BTN =
  'flex items-center gap-1.5 rounded-pill border border-border bg-surface2 px-5 py-2.5 text-[13.5px] font-semibold text-text disabled:cursor-not-allowed disabled:opacity-60'

/** Exchange-select row (button or locked div). */
const WIZ_OPTION =
  'flex w-full items-center gap-3.5 rounded-rail border border-border bg-surface2 px-4 py-3.5 text-left'

/** Small pill on a locked/connected option. */
const WIZ_SOON =
  'flex flex-none items-center gap-[5px] whitespace-nowrap rounded-pill border px-2.5 py-1 text-[10.5px] font-bold'

/**
 * Two-step connect wizard: pick an exchange (Bybit/MEXC still locked),
 * then enter Binance API credentials. Saves to binance_accounts via the API.
 */
export default function ConnectExchangeWizard({
  open,
  onClose,
  onConnected,
  connectedKinds = [],
}: ConnectExchangeWizardProps) {
  const [step, setStep] = useState<Step>('select')
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Reset the wizard every time it opens
  useEffect(() => {
    if (open) {
      setStep('select')
      setForm(EMPTY_FORM)
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleSelect = (kind: ExchangeKind) => {
    // One account per exchange — connected ones can't be selected again.
    if (!EXCHANGE_META[kind].available || connectedKinds.includes(kind)) return
    setError(null)
    setStep('binance')
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const account = await connectBinanceAccount({
        name: form.name.trim(),
        api_key: form.api_key.trim(),
        secret_key: form.secret_key.trim(),
      })
      onConnected(account)
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to connect Binance account.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex animate-[fadeup_0.2s_ease_both] items-center justify-center bg-black/55 backdrop-blur-[3px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Connect an exchange"
    >
      <div
        className="max-h-[calc(100vh-64px)] w-[calc(100%-48px)] max-w-[520px] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both] overflow-y-auto rounded-[20px] border border-border bg-surface p-7 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'select' ? (
          <>
            <p className="font-mono text-[10.5px] tracking-[0.14em] text-accent">
              STEP 1 OF 2
            </p>
            <h3 className="mt-1.5 font-display text-[20px] font-extrabold tracking-[-0.02em] text-text">
              Connect an exchange
            </h3>
            <p className="mt-1 text-[13px] leading-[1.6] text-muted">
              Choose which exchange you want to connect to your account.
            </p>

            <div className="mt-[18px] flex flex-col gap-2.5">
              {EXCHANGE_ORDER.map((kind) => {
                const meta = EXCHANGE_META[kind]
                const isConnected = connectedKinds.includes(kind)
                if (isConnected) {
                  return (
                    <div
                      key={kind}
                      className={`${WIZ_OPTION} cursor-not-allowed opacity-60`}
                      aria-disabled="true"
                    >
                      <span
                        className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-row border font-display text-[19px] font-extrabold"
                        style={{
                          color: meta.color,
                          background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
                          borderColor: `color-mix(in srgb, ${meta.color} 22%, transparent)`,
                        }}
                      >
                        {meta.label[0]}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[14px] font-bold text-text">
                          {meta.label}
                        </span>
                        <span className="text-[12px] text-muted">
                          One account per exchange — disconnect it first to
                          connect a different one
                        </span>
                      </span>
                      <span
                        className={`${WIZ_SOON} border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] text-green`}
                      >
                        <Check size={11} />
                        Connected
                      </span>
                    </div>
                  )
                }
                return meta.available ? (
                  <button
                    key={kind}
                    type="button"
                    className={`${WIZ_OPTION} cursor-pointer transition-[border-color,background,transform] duration-150 hover:-translate-y-px hover:border-accent-line hover:bg-accent-soft`}
                    onClick={() => handleSelect(kind)}
                  >
                    <span
                      className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-row border font-display text-[19px] font-extrabold"
                      style={{
                        color: meta.color,
                        background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                        borderColor: `color-mix(in srgb, ${meta.color} 35%, transparent)`,
                      }}
                    >
                      {meta.label[0]}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[14px] font-bold text-text">
                        {meta.label}
                      </span>
                      <span className="text-[12px] text-muted">
                        {meta.blurb}
                      </span>
                    </span>
                    <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-accent-soft text-accent">
                      <Plus size={15} />
                    </span>
                  </button>
                ) : (
                  <div
                    key={kind}
                    className={`${WIZ_OPTION} cursor-not-allowed opacity-60`}
                    aria-disabled="true"
                  >
                    <span
                      className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-row border font-display text-[19px] font-extrabold"
                      style={{
                        color: meta.color,
                        background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
                        borderColor: `color-mix(in srgb, ${meta.color} 22%, transparent)`,
                      }}
                    >
                      {meta.label[0]}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[14px] font-bold text-text">
                        {meta.label}
                      </span>
                      <span className="text-[12px] text-muted">
                        {meta.blurb}
                      </span>
                    </span>
                    <span
                      className={`${WIZ_SOON} border-border bg-surface text-muted`}
                    >
                      <Lock size={11} />
                      Coming soon
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-[18px] flex justify-end gap-2.5">
              <button type="button" className={WIZ_BTN} onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="font-mono text-[10.5px] tracking-[0.14em] text-accent">
              STEP 2 OF 2
            </p>
            <h3 className="mt-1.5 font-display text-[20px] font-extrabold tracking-[-0.02em] text-text">
              Connect Binance account
            </h3>
            <p className="mt-1 text-[13px] leading-[1.6] text-muted">
              Enter your Binance API credentials. Use trade-only keys —
              withdrawals stay disabled.
            </p>

            <form
              className="mt-[18px] flex flex-col gap-3.5"
              onSubmit={onSubmit}
            >
              <label className="flex flex-col gap-1.5">
                <span className={WIZ_LABEL}>ACCOUNT NAME</span>
                <input
                  type="text"
                  className={WIZ_INPUT}
                  placeholder="e.g. Main Trading"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  maxLength={128}
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={WIZ_LABEL}>API KEY</span>
                <input
                  type="text"
                  className={`${WIZ_INPUT} font-mono text-[12.5px]`}
                  placeholder="Enter your Binance API key"
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  required
                  maxLength={128}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={WIZ_LABEL}>SECRET KEY</span>
                <input
                  type="password"
                  className={`${WIZ_INPUT} font-mono text-[12.5px]`}
                  placeholder="Enter your Binance secret key"
                  value={form.secret_key}
                  onChange={(e) =>
                    setForm({ ...form, secret_key: e.target.value })
                  }
                  required
                  maxLength={128}
                />
              </label>

              <p className="flex items-center gap-1.5 text-[11.5px] text-muted">
                <ShieldCheck size={13} />
                Your keys are stored securely and never shared.
              </p>

              {error && (
                <p
                  className="rounded-field border border-[rgba(255,90,90,0.3)] bg-[rgba(255,90,90,0.08)] px-3 py-[9px] text-[12.5px] text-red"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <div className="mt-[18px] flex justify-end gap-2.5">
                <button
                  type="button"
                  className={WIZ_BTN}
                  onClick={() => {
                    setError(null)
                    setStep('select')
                  }}
                  disabled={submitting}
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-pill border-none bg-accent px-5 py-2.5 text-[13.5px] font-bold text-on-accent shadow-[0_10px_24px_var(--glow)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting}
                >
                  {submitting ? 'Connecting…' : 'Connect Binance'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

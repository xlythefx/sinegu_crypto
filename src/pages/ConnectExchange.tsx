import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Link2, Loader2, X } from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import ConfirmModal from '../components/ui/ConfirmModal'
import StepRail, {
  type WizardStep,
} from '../components/exchanges/connect/StepRail'
import ExchangeStep from '../components/exchanges/connect/ExchangeStep'
import ModeStep from '../components/exchanges/connect/ModeStep'
import KeysStep, {
  type KeysForm,
} from '../components/exchanges/connect/KeysStep'
import ReviewStep from '../components/exchanges/connect/ReviewStep'
import ConnectedStep from '../components/exchanges/connect/ConnectedStep'
import {
  CARD,
  ERROR_STRIP,
  GHOST_BTN,
  PRIMARY_BTN,
  STEP_FOOTER,
} from '../components/exchanges/connect/classes'
import { useApiData } from '../hooks/useApiData'
import {
  connectBinanceAccount,
  getExchangeAccountsWithMeta,
  type ConnectBinanceResult,
} from '../services/exchanges'
import { ApiError, getApiErrorMessage } from '../services/api'
import { updateStoredUser } from '../lib/session'
import type { ExchangeKind } from '../types/exchanges'

const STEPS: WizardStep[] = [
  { key: 'exchange', label: 'Exchange', hint: 'Where you trade' },
  { key: 'mode', label: 'Mode', hint: 'Live or demo' },
  { key: 'keys', label: 'API keys', hint: 'Trade-only credentials' },
  { key: 'review', label: 'Review', hint: 'Confirm and connect' },
]

const EMPTY_FORM: KeysForm = { name: '', api_key: '', secret_key: '' }

/**
 * Full-page connect wizard (`/dashboard/exchanges/connect`), replacing the old
 * modal.
 *
 * A page, not a dialog, because connecting is a multi-app task: the user leaves
 * for Binance to create a key and comes back, often on a phone. A modal made
 * that a trip through a scrollable overlay with the instructions and the fields
 * competing for the same 520px; a route survives the trip, can be linked to
 * from the onboarding strip, and has room to put the instructions BESIDE the
 * fields instead of above them.
 *
 * Step state lives here and the steps stay presentational — the wizard is one
 * form submitted once, so splitting the state across the steps would only
 * scatter it.
 */
export default function ConnectExchange() {
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApiData(getExchangeAccountsWithMeta)

  const [stepIndex, setStepIndex] = useState(0)
  const [kind, setKind] = useState<ExchangeKind | null>(null)
  const [demo, setDemo] = useState<boolean | null>(null)
  const [form, setForm] = useState<KeysForm>(EMPTY_FORM)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [connected, setConnected] = useState<ConnectBinanceResult | null>(null)

  const accounts = data?.accounts ?? []

  // Every stored account is Binance until the bybit_*/mexc_* tables land — at
  // which point the "already connected" guard below becomes per-exchange and
  // this is what marks the taken ones in step 1.
  const connectedKinds: ExchangeKind[] = accounts.length > 0 ? ['binance'] : []

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const filled = {
    name: form.name.trim().length > 0,
    api_key: form.api_key.trim().length > 0,
    secret_key: form.secret_key.trim().length > 0,
  }

  const canContinue =
    (stepIndex === 0 && kind !== null) ||
    (stepIndex === 1 && demo !== null) ||
    (stepIndex === 2 && filled.name && filled.api_key && filled.secret_key) ||
    stepIndex === 3

  const submit = async () => {
    if (kind === null || demo === null) return
    setConfirmOpen(false)
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await connectBinanceAccount({
        name: form.name.trim(),
        api_key: form.api_key.trim(),
        secret_key: form.secret_key.trim(),
        demo,
      })
      // Keep the session flag in sync so the onboarding nudges clear instantly,
      // without waiting on an /auth/me round-trip.
      updateStoredUser({ has_exchange_account: true })
      setConnected(result)
    } catch (err) {
      setSubmitError(
        getApiErrorMessage(err, 'Failed to connect Binance account.'),
      )
      // A rejected key or a taken name is fixed on the credentials step, so
      // send them back to it rather than leaving the error on a read-only page.
      if (err instanceof ApiError && err.status === 422) setStepIndex(2)
    } finally {
      setSubmitting(false)
    }
  }

  if (!data) {
    return (
      <DashboardLayout title="Connect an exchange">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="exchange accounts"
        />
      </DashboardLayout>
    )
  }

  if (connected) {
    return (
      <DashboardLayout title="Exchange connected">
        <div className={`${CARD} mx-auto max-w-[720px] animate-[fadeup_0.35s_ease-out]`}>
          <ConnectedStep
            account={connected.account}
            reconnected={connected.reconnected}
          />
        </div>
      </DashboardLayout>
    )
  }

  // One account per user: the wizard has nothing to offer until they disconnect.
  if (accounts.length > 0) {
    return (
      <DashboardLayout title="Connect an exchange">
        <div
          className={`${CARD} mx-auto max-w-[560px] text-center animate-[fadeup_0.35s_ease-out]`}
        >
          <span className="mx-auto grid h-[60px] w-[60px] place-items-center rounded-[18px] border border-accent-line bg-accent-soft text-accent">
            <Link2 size={26} />
          </span>
          <h2 className="mt-4 font-display text-[19px] font-extrabold tracking-[-0.02em]">
            You already have an account connected
          </h2>
          <p className="mx-auto mt-2 max-w-[400px] text-[13px] leading-[1.6] text-muted">
            You can hold one Binance account at a time — {accounts[0].name} is
            using the slot. Disconnect it first to connect different keys, or to
            switch between live and demo.
          </p>
          <Link className={`${PRIMARY_BTN} mt-5`} to="/dashboard/exchanges">
            Back to exchange accounts
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Connect an exchange">
      <div className="mx-auto max-w-[900px]">
        <div
          className="mb-5 flex flex-wrap items-start justify-between gap-3"
          data-aos="fade-up"
        >
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.12em] text-accent">
              NEW CONNECTION
            </p>
            <h1 className="mt-1 font-display text-[24px] font-extrabold tracking-[-0.02em]">
              Connect an exchange
            </h1>
            <p className="mt-0.5 max-w-[520px] text-[13px] leading-[1.55] text-muted">
              Four short steps. Use trade-only API keys — the bot places and
              closes positions, and can never withdraw.
            </p>
          </div>
          <Link
            className="flex h-9 items-center gap-1.5 rounded-pill border border-border bg-surface px-3.5 text-[12.5px] font-semibold text-muted transition-colors duration-150 hover:border-accent-line hover:text-text"
            to="/dashboard/exchanges"
          >
            <X size={14} />
            Cancel
          </Link>
        </div>

        <StepRail
          steps={STEPS}
          current={stepIndex}
          onJump={(i) => {
            setSubmitError(null)
            setStepIndex(i)
          }}
        />

        {/* Keyed fadeup, not AOS: AOS (once: true) never reveals nodes mounted
            after init, so a step swapped in here would stay at opacity 0. */}
        <div
          key={STEPS[stepIndex].key}
          className={`${CARD} animate-[fadeup_0.35s_ease-out]`}
        >
          {stepIndex === 0 && (
            <ExchangeStep
              selected={kind}
              connectedKinds={connectedKinds}
              onSelect={(k) => {
                setKind(k)
                setStepIndex(1)
              }}
            />
          )}

          {stepIndex === 1 && (
            <ModeStep
              demo={demo}
              onSelect={(value) => {
                setDemo(value)
                setStepIndex(2)
              }}
            />
          )}

          {stepIndex === 2 && (
            <KeysStep
              demo={demo ?? false}
              form={form}
              onChange={setForm}
              serverIp={data.serverIp}
            />
          )}

          {stepIndex === 3 && kind !== null && demo !== null && (
            <ReviewStep kind={kind} demo={demo} form={form} />
          )}

          {submitError && (
            <p className={`${ERROR_STRIP} mt-4`} role="alert">
              {submitError}
            </p>
          )}

          <div className={STEP_FOOTER}>
            <button
              type="button"
              className={GHOST_BTN}
              onClick={() => {
                setSubmitError(null)
                if (stepIndex === 0) navigate('/dashboard/exchanges')
                else setStepIndex(stepIndex - 1)
              }}
              disabled={submitting}
            >
              <ArrowLeft size={15} />
              {stepIndex === 0 ? 'Cancel' : 'Back'}
            </button>

            {stepIndex < STEPS.length - 1 ? (
              <button
                type="button"
                className={PRIMARY_BTN}
                onClick={() => setStepIndex(stepIndex + 1)}
                disabled={!canContinue}
              >
                Continue
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                className={PRIMARY_BTN}
                onClick={() => setConfirmOpen(true)}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2
                    size={15}
                    className="animate-[dstate-spin_0.8s_linear_infinite]"
                  />
                ) : (
                  <Link2 size={15} />
                )}
                {submitting ? 'Connecting…' : 'Connect account'}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={demo ? 'Connect this demo account?' : 'Connect this live account?'}
        message={
          demo
            ? 'Orders will be placed on the Binance futures testnet with play money. You can disconnect at any time.'
            : 'From the next signal the bot will place REAL futures orders using these keys, on your real Binance balance. You can disconnect at any time.'
        }
        confirmLabel={demo ? 'Yes, connect demo' : 'Yes, connect live'}
        cancelLabel="No"
        onConfirm={submit}
        onCancel={() => setConfirmOpen(false)}
      />
    </DashboardLayout>
  )
}

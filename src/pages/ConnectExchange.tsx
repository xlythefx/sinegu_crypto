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
import {
  EXCHANGE_META,
  connectableExchanges,
  exchangeOf,
} from '../components/exchanges/meta'
import { useApiData } from '../hooks/useApiData'
import { useSessionUser } from '../hooks/useSessionUser'
import {
  connectExchangeAccount,
  getExchangeAccountsWithMeta,
  type ConnectExchangeResult,
} from '../services/exchanges'
import { ApiError, getApiErrorMessage } from '../services/api'
import { updateStoredUser } from '../lib/session'
import type { ExchangeKind } from '../types/exchanges'

type StepKey = 'exchange' | 'mode' | 'keys' | 'review'

const STEP: Record<StepKey, WizardStep> = {
  exchange: { key: 'exchange', label: 'Exchange', hint: 'Where you trade' },
  mode: { key: 'mode', label: 'Mode', hint: 'Live or demo' },
  keys: { key: 'keys', label: 'API keys', hint: 'Trade-only credentials' },
  review: { key: 'review', label: 'Review', hint: 'Confirm and connect' },
}

/**
 * The steps for a given exchange. The live/demo step exists only where the
 * venue has a futures testnet to route a demo account to; on MEXC there is
 * none, so asking would offer a choice with one answer.
 */
function stepsFor(kind: ExchangeKind | null): WizardStep[] {
  const hasMode = kind === null || EXCHANGE_META[kind].hasTestnet
  return hasMode
    ? [STEP.exchange, STEP.mode, STEP.keys, STEP.review]
    : [STEP.exchange, STEP.keys, STEP.review]
}

const EMPTY_FORM: KeysForm = { name: '', api_key: '', secret_key: '' }

/**
 * Full-page connect wizard (`/dashboard/exchanges/connect`), replacing the old
 * modal.
 *
 * A page, not a dialog, because connecting is a multi-app task: the user leaves
 * for the exchange to create a key and comes back, often on a phone. A modal
 * made that a trip through a scrollable overlay with the instructions and the
 * fields competing for the same 520px; a route survives the trip, can be linked
 * to from the onboarding strip, and has room to put the instructions BESIDE the
 * fields instead of above them.
 *
 * Step state lives here and the steps stay presentational — the wizard is one
 * form submitted once, so splitting the state across the steps would only
 * scatter it. One account per user PER exchange: a connected venue is locked
 * in step 1, the others stay open.
 */
export default function ConnectExchange() {
  const navigate = useNavigate()
  const sessionUser = useSessionUser()
  const { data, loading, error, reload } = useApiData(getExchangeAccountsWithMeta)

  const [stepIndex, setStepIndex] = useState(0)
  const [kind, setKind] = useState<ExchangeKind | null>(null)
  const [demo, setDemo] = useState<boolean | null>(null)
  const [form, setForm] = useState<KeysForm>(EMPTY_FORM)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [connected, setConnected] = useState<ConnectExchangeResult | null>(null)

  const accounts = data?.accounts ?? []
  const connectedKinds: ExchangeKind[] = accounts.map(exchangeOf)
  // Venues this user may connect, minus the ones they already hold. A
  // staff-only venue (MEXC today) is simply not on offer to a customer — the
  // API refuses it anyway, and a wizard that lets them fill in keys first
  // would only be a longer way to say no.
  const role = sessionUser?.type
  const openKinds = connectableExchanges(role).filter((k) => !connectedKinds.includes(k))

  const steps = stepsFor(kind)
  const current: StepKey = (steps[Math.min(stepIndex, steps.length - 1)]?.key ?? 'exchange') as StepKey
  const label = kind ? EXCHANGE_META[kind].label : 'exchange'

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const filled = {
    name: form.name.trim().length > 0,
    api_key: form.api_key.trim().length > 0,
    secret_key: form.secret_key.trim().length > 0,
  }

  const canContinue =
    (current === 'exchange' && kind !== null) ||
    (current === 'mode' && demo !== null) ||
    (current === 'keys' && filled.name && filled.api_key && filled.secret_key) ||
    current === 'review'

  const goTo = (key: StepKey) => {
    setSubmitError(null)
    setStepIndex(Math.max(0, steps.findIndex((s) => s.key === key)))
  }

  const selectExchange = (k: ExchangeKind) => {
    setKind(k)
    setSubmitError(null)
    if (EXCHANGE_META[k].hasTestnet) {
      // A venue with a testnet gets the choice; a previous venue's answer is
      // not carried over — the sites the keys come from differ.
      setDemo(null)
      setStepIndex(1) // mode
    } else {
      setDemo(false)
      setStepIndex(1) // keys — stepsFor(k) has no mode step
    }
  }

  const submit = async () => {
    if (kind === null || demo === null) return
    setConfirmOpen(false)
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await connectExchangeAccount(kind, {
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
        getApiErrorMessage(err, `Failed to connect ${label} account.`),
      )
      // A rejected key or a taken name is fixed on the credentials step, so
      // send them back to it rather than leaving the error on a read-only page.
      if (err instanceof ApiError && err.status === 422) goTo('keys')
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

  // One account per exchange: with every supported venue taken, the wizard
  // has nothing to offer until they disconnect one.
  if (openKinds.length === 0) {
    const names = accounts.map((a) => `${a.name} (${EXCHANGE_META[exchangeOf(a)].label})`)
    return (
      <DashboardLayout title="Connect an exchange">
        <div
          className={`${CARD} mx-auto max-w-[560px] text-center animate-[fadeup_0.35s_ease-out]`}
        >
          <span className="mx-auto grid h-[60px] w-[60px] place-items-center rounded-[18px] border border-accent-line bg-accent-soft text-accent">
            <Link2 size={26} />
          </span>
          <h2 className="mt-4 font-display text-[19px] font-extrabold tracking-[-0.02em]">
            Every exchange is already connected
          </h2>
          <p className="mx-auto mt-2 max-w-[400px] text-[13px] leading-[1.6] text-muted">
            You can hold one account per exchange — {names.join(' and ')}{' '}
            {names.length === 1 ? 'is' : 'are'} using the slots. Disconnect one
            first to connect different keys, or to switch between live and demo.
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
              {steps.length === 3 ? 'Three' : 'Four'} short steps. Use trade-only
              API keys — the bot places and closes positions, and can never
              withdraw.
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
          steps={steps}
          current={stepIndex}
          onJump={(i) => {
            setSubmitError(null)
            setStepIndex(i)
          }}
        />

        {/* Keyed fadeup, not AOS: AOS (once: true) never reveals nodes mounted
            after init, so a step swapped in here would stay at opacity 0. */}
        <div
          key={current}
          className={`${CARD} animate-[fadeup_0.35s_ease-out]`}
        >
          {current === 'exchange' && (
            <ExchangeStep
              selected={kind}
              connectedKinds={connectedKinds}
              role={role}
              onSelect={selectExchange}
            />
          )}

          {current === 'mode' && kind !== null && (
            <ModeStep
              kind={kind}
              demo={demo}
              onSelect={(value) => {
                setDemo(value)
                goTo('keys')
              }}
            />
          )}

          {current === 'keys' && kind !== null && (
            <KeysStep
              kind={kind}
              demo={demo ?? false}
              form={form}
              onChange={setForm}
              serverIp={data.serverIp}
            />
          )}

          {current === 'review' && kind !== null && demo !== null && (
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

            {current !== 'review' ? (
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
            ? `Orders will be placed on the ${label} futures testnet with play money. You can disconnect at any time.`
            : `From the next signal the bot will place REAL futures orders using these keys, on your real ${label} balance. You can disconnect at any time.`
        }
        confirmLabel={demo ? 'Yes, connect demo' : 'Yes, connect live'}
        cancelLabel="No"
        onConfirm={submit}
        onCancel={() => setConfirmOpen(false)}
      />
    </DashboardLayout>
  )
}

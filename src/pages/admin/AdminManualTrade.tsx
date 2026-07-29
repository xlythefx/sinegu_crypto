import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Radio,
  Send,
  Sliders,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import RecipientPicker from '../../components/admin/manual-trade/RecipientPicker'
import TickerPicker from '../../components/admin/manual-trade/TickerPicker'
import {
  BTN,
  BTN_PRIMARY,
  CARD,
  CARD_HEAD,
  CARD_SUB,
  CARD_TITLE,
  CHIP,
  INPUT,
  LABEL,
  MSG,
  MSG_ERR,
  MSG_OK,
  MSG_WARN,
  SEG,
  SEG_OFF,
  SEG_ON,
  STEP,
} from '../../components/admin/manual-trade/classes'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../../components/exchanges/meta'
import { useApiData } from '../../hooks/useApiData'
import { getAdminAssets } from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'
import {
  getEngineStatus,
  getManualTradeTargets,
  sendManualTrade,
} from '../../services/manualTrade'
import type { ExchangeKind } from '../../types/exchanges'
import type {
  EngineStatus,
  EngineTarget,
  ManualTradeResult,
  ManualTradeTarget,
  RecipientMode,
  TradeAction,
} from '../../types/manualTrade'

const ACTIONS: { value: TradeAction; label: string }[] = [
  { value: 'BUY', label: 'Buy (long)' },
  { value: 'SELL', label: 'Sell (short)' },
  { value: 'EXIT_LONG', label: 'Exit long' },
  { value: 'EXIT_SHORT', label: 'Exit short' },
]

const TARGETS: { value: EngineTarget; label: string; hint: string }[] = [
  { value: 'local', label: 'Local', hint: 'Engine on this machine (127.0.0.1:5010)' },
  { value: 'prod', label: 'Production', hint: 'The deployed engine — real orders' },
]

const isEntry = (action: TradeAction) => action === 'BUY' || action === 'SELL'

/** Assets belonging to one exchange, tolerating broker casing/blanks. */
const brokerMatches = (broker: string | null, exchange: ExchangeKind) =>
  (broker ?? '').trim().toLowerCase() === exchange

/**
 * Manual trade console — the browser replacement for the engine's Tkinter
 * tester. Builds a TradingView-shaped signal and hands it to the API, which
 * signs it with the webhook secret and forwards it to the engine. Nothing
 * secret is ever exposed to this page.
 */
export default function AdminManualTrade() {
  const { data: assets, loading, error, reload } = useApiData(getAdminAssets)

  /* ---- form ---- */
  const [exchange, setExchange] = useState<ExchangeKind>('binance')
  const [ticker, setTicker] = useState('')
  const [action, setAction] = useState<TradeAction>('BUY')
  const [increments, setIncrements] = useState(1)
  const [price, setPrice] = useState('')
  const [leverage, setLeverage] = useState('')
  const [strategy, setStrategy] = useState('Manual-Test')
  const [target, setTarget] = useState<EngineTarget>('local')

  /* ---- recipients ---- */
  const [mode, setMode] = useState<RecipientMode>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [targets, setTargets] = useState<ManualTradeTarget[]>([])
  const [targetsLoading, setTargetsLoading] = useState(true)

  /* ---- engine + send ---- */
  const [engine, setEngine] = useState<EngineStatus | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<ManualTradeResult | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const exchangeMeta = EXCHANGE_META[exchange]

  useEffect(() => {
    let alive = true
    setTargetsLoading(true)
    setSelected([])
    getManualTradeTargets(exchange)
      .then((rows) => alive && setTargets(rows))
      .catch(() => alive && setTargets([]))
      .finally(() => alive && setTargetsLoading(false))
    return () => {
      alive = false
    }
  }, [exchange])

  useEffect(() => {
    let alive = true
    setEngine(null)
    getEngineStatus(target)
      .then((status) => alive && setEngine(status))
      .catch(() => alive && setEngine(null))
    return () => {
      alive = false
    }
  }, [target])

  const exchangeAssets = useMemo(
    () => (assets ?? []).filter((a) => a.enabled && brokerMatches(a.broker, exchange)),
    [assets, exchange],
  )

  const selectedAsset = exchangeAssets.find((a) => a.ticker === ticker)

  /* Same rule the engine enforces: an asset locked to one side blocks the other. */
  const sideBlocked =
    isEntry(action) &&
    selectedAsset != null &&
    selectedAsset.side !== 'ALL' &&
    selectedAsset.side !== (action === 'BUY' ? 'LONG' : 'SHORT')

  const recipientCount = mode === 'selected' ? selected.length : targets.length
  const recipientLabel =
    mode === 'selected'
      ? `${selected.length} selected user${selected.length === 1 ? '' : 's'}`
      : `all ${targets.length} eligible user${targets.length === 1 ? '' : 's'}`

  const ready = !!ticker && recipientCount > 0 && !sideBlocked && !sending

  const payloadPreview = useMemo(
    () =>
      JSON.stringify(
        {
          secret: '••••••  (added by the API, never sent from the browser)',
          action,
          symbol: ticker || '—',
          ...(price ? { price } : {}),
          ...(leverage ? { leverage } : {}),
          ...(strategy ? { strategy } : {}),
          ...(mode === 'selected' && selected.length > 0
            ? { target_uni_ids: selected }
            : {}),
        },
        null,
        2,
      ),
    [action, ticker, price, leverage, strategy, mode, selected],
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const execute = async () => {
    setSending(true)
    setSendError(null)
    setResult(null)
    try {
      const res = await sendManualTrade({
        exchange,
        target,
        action,
        symbol: ticker,
        price: price ? Number(price) : null,
        leverage: leverage ? Number(leverage) : null,
        strategy: strategy || null,
        increments: isEntry(action) ? increments : 1,
        ...(mode === 'selected' ? { target_uni_ids: selected } : {}),
      })
      setResult(res)
    } catch (err) {
      setSendError(getApiErrorMessage(err, 'Could not reach the engine.'))
    } finally {
      setSending(false)
    }
  }

  const header = (
    <div className="flex items-center gap-3 mb-[18px]" data-aos="fade-up">
      <Link
        to="/admin/sandbox"
        aria-label="Back to Sandbox"
        className="grid place-items-center w-9 h-9 flex-none rounded-[10px] border border-border bg-surface2 text-muted transition-[border-color,color] duration-150 hover:border-accent hover:text-text"
      >
        <ArrowLeft size={16} />
      </Link>
      <p className="text-[12.5px] text-muted leading-[1.5]">
        Sends a TradingView-shaped signal straight to the trading engine. The engine
        fans it out to every recipient — the same path a real alert takes.
      </p>
    </div>
  )

  if (!assets) {
    return (
      <AdminLayout title="Manual Trade" subtitle="Fire a signal at the trading engine.">
        {header}
        <DataState loading={loading} error={error} onRetry={reload} label="assets" />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Manual Trade" subtitle="Fire a signal at the trading engine.">
      {header}

      <div className="grid grid-cols-[1fr_380px] max-[1080px]:grid-cols-1 gap-4 items-start">
        {/* ============ left: the signal ============ */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* 1 · exchange */}
          <section className={CARD} data-aos="fade-up">
            <div className={CARD_HEAD}>
              <span className={STEP}>1</span>
              <div className="min-w-0">
                <div className={CARD_TITLE}>Exchange</div>
                <div className={CARD_SUB}>Binance is the only engine running today.</div>
              </div>
            </div>
            <div className="grid grid-cols-3 max-[560px]:grid-cols-1 gap-2.5">
              {EXCHANGE_ORDER.map((kind) => {
                const meta = EXCHANGE_META[kind]
                const on = exchange === kind
                return (
                  <button
                    key={kind}
                    type="button"
                    disabled={!meta.available}
                    onClick={() => {
                      setExchange(kind)
                      setTicker('')
                    }}
                    className={`flex flex-col items-center gap-1.5 rounded-[12px] border-2 p-3.5 cursor-pointer transition-[border-color,background,transform] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${
                      on
                        ? 'border-accent bg-accent-soft'
                        : 'border-border bg-surface2 enabled:hover:border-accent-line'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <span
                      className={`text-[13px] font-bold ${on ? 'text-accent' : 'text-text'}`}
                    >
                      {meta.label}
                    </span>
                    {!meta.available && (
                      <span className="text-[10.5px] text-muted">Coming soon</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* 2 · asset */}
          <TickerPicker
            assets={exchangeAssets}
            value={ticker}
            onChange={setTicker}
            exchangeLabel={exchangeMeta.label}
          />

          {/* 3 · action */}
          <section className={CARD} data-aos="fade-up" data-aos-delay="60">
            <div className={CARD_HEAD}>
              <span className={STEP}>3</span>
              <div className="min-w-0">
                <div className={CARD_TITLE}>Action</div>
                <div className={CARD_SUB}>
                  Exits close whatever is open — they skip every size and asset gate.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  className={`${SEG} ${action === a.value ? SEG_ON : SEG_OFF}`}
                  onClick={() => setAction(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {sideBlocked && (
              <div className={`${MSG} ${MSG_WARN} mt-3.5`} role="alert">
                <AlertTriangle size={15} className="flex-none mt-px" />
                <span>
                  {ticker} is configured <strong>{selectedAsset?.side} only</strong> — the
                  engine would reject this entry. Pick the other direction or change the
                  asset.
                </span>
              </div>
            )}

            {isEntry(action) && (
              <div className="grid grid-cols-3 max-[560px]:grid-cols-1 gap-3.5 mt-4">
                <div>
                  <label className={LABEL} htmlFor="mt-increments">
                    Increments
                  </label>
                  <input
                    id="mt-increments"
                    className={INPUT}
                    type="number"
                    min={1}
                    max={20}
                    value={increments}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      setIncrements(Number.isNaN(v) ? 1 : Math.min(20, Math.max(1, v)))
                    }}
                  />
                  <p className="mt-1 text-[11px] text-muted leading-[1.4]">
                    Each one sends a separate signal, stacking another size.
                  </p>
                </div>
                <div>
                  <label className={LABEL} htmlFor="mt-leverage">
                    Leverage (optional)
                  </label>
                  <input
                    id="mt-leverage"
                    className={INPUT}
                    type="number"
                    min={1}
                    max={125}
                    placeholder="e.g. 20"
                    value={leverage}
                    onChange={(e) => setLeverage(e.target.value)}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="mt-price">
                    Price (optional)
                  </label>
                  <input
                    id="mt-price"
                    className={INPUT}
                    type="number"
                    step="any"
                    placeholder="alert price"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="mt-3.5">
              <label className={LABEL} htmlFor="mt-strategy">
                Strategy tag (optional)
              </label>
              <input
                id="mt-strategy"
                className={INPUT}
                placeholder="e.g. VWMA-Reversion"
                maxLength={100}
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted leading-[1.4]">
                Stored with the position so the closing trade keeps the same label.
              </p>
            </div>
          </section>

          {/* 4 · engine target */}
          <section className={CARD} data-aos="fade-up" data-aos-delay="60">
            <div className={CARD_HEAD}>
              <span className={STEP}>4</span>
              <div className="min-w-0">
                <div className={CARD_TITLE}>Engine</div>
                <div className={CARD_SUB}>
                  Where the signal goes. Demo accounts always route to the Binance
                  testnet; live accounts trade real funds.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 max-[560px]:grid-cols-1 gap-2.5">
              {TARGETS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`${SEG} flex flex-col items-start gap-0.5 text-left ${
                    target === t.value ? SEG_ON : SEG_OFF
                  }`}
                  onClick={() => setTarget(t.value)}
                >
                  <span>{t.label}</span>
                  <span
                    className={`text-[11px] font-normal ${
                      target === t.value ? 'opacity-80' : 'text-muted'
                    }`}
                  >
                    {t.hint}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-3.5 text-[12px]">
              <Radio
                size={14}
                className={
                  engine === null
                    ? 'text-muted'
                    : engine.reachable
                      ? 'text-green'
                      : 'text-red'
                }
              />
              {engine === null ? (
                <span className="text-muted">Checking engine…</span>
              ) : engine.reachable ? (
                <span className="text-muted">
                  <span className="font-bold text-green">Online</span> ·{' '}
                  <span className="font-mono">{engine.url}</span>
                  {engine.health?.service ? ` · ${engine.health.service}` : ''}
                </span>
              ) : (
                <span className="text-muted">
                  <span className="font-bold text-red">Unreachable</span> ·{' '}
                  <span className="font-mono">{engine.url}</span> — start it with{' '}
                  <code className="font-mono">python -m binance_abcd.main</code>
                </span>
              )}
            </div>
          </section>
        </div>

        {/* ============ right: recipients + send ============ */}
        <div className="flex flex-col gap-4 min-w-0 sticky top-4 max-[1080px]:static">
          <RecipientPicker
            targets={targets}
            loading={targetsLoading}
            mode={mode}
            onModeChange={setMode}
            selected={selected}
            onSelectedChange={setSelected}
          />

          <section className={CARD} data-aos="fade-up" data-aos-delay="120">
            <div className={CARD_HEAD}>
              <span className={CHIP}>
                <Sliders size={16} />
              </span>
              <div className="min-w-0">
                <div className={CARD_TITLE}>Review &amp; send</div>
                <div className={CARD_SUB}>The engine acks instantly, then executes.</div>
              </div>
            </div>

            <dl className="flex flex-col gap-1.5 rounded-[12px] border border-hair bg-surface2 p-3.5 text-[12.5px] mb-3.5">
              {[
                ['Exchange', exchangeMeta.label],
                ['Ticker', ticker || '—'],
                ['Action', action],
                ...(isEntry(action) ? [['Increments', String(increments)]] : []),
                ['Recipients', recipientLabel],
                ['Engine', target === 'prod' ? 'Production' : 'Local'],
              ].map(([label, value]) => (
                <div className="flex justify-between gap-3" key={label}>
                  <dt className="text-muted">{label}</dt>
                  <dd
                    className={`font-bold text-right ${
                      label === 'Engine' && target === 'prod' ? 'text-red' : 'text-text'
                    }`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">
              Payload preview
            </p>
            <pre className="max-h-[172px] overflow-auto rounded-[10px] border border-hair bg-surface2 p-2.5 font-mono text-[11px] leading-[1.5] text-text mb-3.5">
              {payloadPreview}
            </pre>

            {sendError && (
              <div className={`${MSG} ${MSG_ERR} mb-3`} role="alert">
                <AlertTriangle size={15} className="flex-none mt-px" />
                <span>{sendError}</span>
              </div>
            )}

            {result && (
              <div
                className={`${MSG} ${result.success ? MSG_OK : MSG_ERR} mb-3`}
                role="status"
              >
                {result.success ? (
                  <CheckCircle2 size={15} className="flex-none mt-px" />
                ) : (
                  <AlertTriangle size={15} className="flex-none mt-px" />
                )}
                <span>
                  {result.message}
                  {result.success && (
                    <>
                      {' '}
                      Results land in{' '}
                      <Link className="font-bold underline" to="/admin/positions">
                        Positions
                      </Link>{' '}
                      once the fan-out finishes.
                    </>
                  )}
                </span>
              </div>
            )}

            <button
              type="button"
              className={`${BTN} ${BTN_PRIMARY} w-full`}
              disabled={!ready}
              onClick={() => setConfirmOpen(true)}
            >
              {sending ? (
                'Sending…'
              ) : (
                <>
                  <Send size={15} />
                  Send signal
                </>
              )}
            </button>

            {!ticker && (
              <p className="mt-2 text-center text-[11.5px] text-muted">
                Pick a ticker to enable sending.
              </p>
            )}
            {ticker && recipientCount === 0 && (
              <p className="mt-2 text-center text-[11.5px] text-muted">
                Select at least one recipient.
              </p>
            )}
          </section>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={
          target === 'prod'
            ? `Send ${action} ${ticker} to PRODUCTION?`
            : `Send ${action} ${ticker}?`
        }
        message={
          target === 'prod'
            ? `This places real orders on every live account of ${recipientLabel}. Demo accounts stay on the testnet. This cannot be undone.`
            : `${isEntry(action) ? `${increments} signal${increments === 1 ? '' : 's'}` : 'One signal'} will be sent to the local engine for ${recipientLabel}.`
        }
        confirmLabel={sending ? 'Sending…' : 'Yes, send'}
        cancelLabel="Cancel"
        danger={target === 'prod'}
        onConfirm={() => {
          setConfirmOpen(false)
          void execute()
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </AdminLayout>
  )
}

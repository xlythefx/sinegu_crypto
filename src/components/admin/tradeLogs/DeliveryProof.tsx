import { ArrowRight, Timer } from 'lucide-react'
import { fmtDateTimeSeconds } from '../../../lib/format'
import { filledInAll, fmtDuration, outcomeLine, transitLabel } from '../../../lib/signalDelivery'
import type { TradeLogDelivery, TradeLogRow } from '../../../types/tradeLogs'

const STEP = 'flex min-w-0 flex-col gap-0.5'
const STEP_LABEL = 'text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint'
const STEP_VALUE = 'font-mono text-[12.5px] text-text'
const ARROW = 'hidden flex-none text-faint sm:block'

/**
 * The delivery proof on an opened Signal Log row: when TradingView fired the
 * alert, when it reached us, how fast we answered, and what traded. Times are
 * in the reader's zone with seconds, so they line up with TradingView's own
 * alert log entry by entry.
 */
export default function DeliveryProof({ log, delivery }: { log: TradeLogRow; delivery: TradeLogDelivery }) {
  const transit = transitLabel(delivery)
  const traded = filledInAll(log) > 0

  return (
    <div
      className={`rounded-[12px] border p-3 ${
        delivery.slow ? 'border-accent-line bg-accent-soft' : 'border-hair bg-surface2'
      }`}
    >
      <p className={`mb-2.5 flex items-center gap-1.5 ${STEP_LABEL}`}>
        <Timer size={12} aria-hidden="true" />
        Delivery
      </p>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
        <div className={STEP}>
          <span className={STEP_LABEL}>TradingView fired</span>
          <span className={STEP_VALUE}>{delivery.sentAt ? fmtDateTimeSeconds(delivery.sentAt) : 'not sent'}</span>
        </div>
        <ArrowRight size={14} className={ARROW} aria-hidden="true" />
        <div className={STEP}>
          <span className={STEP_LABEL}>Reached us</span>
          <span className={STEP_VALUE}>
            {fmtDateTimeSeconds(delivery.receivedAt)}
            {transit && (
              <span className={delivery.slow ? 'font-semibold text-accent' : 'text-muted'}> · {transit}</span>
            )}
          </span>
        </div>
        <ArrowRight size={14} className={ARROW} aria-hidden="true" />
        <div className={STEP}>
          <span className={STEP_LABEL}>We answered</span>
          <span className={STEP_VALUE}>{delivery.ackMs !== null ? `in ${fmtDuration(delivery.ackMs)}` : '—'}</span>
        </div>
        <ArrowRight size={14} className={ARROW} aria-hidden="true" />
        <div className={STEP}>
          <span className={STEP_LABEL}>Result</span>
          <span className={`${STEP_VALUE} font-semibold ${traded ? 'text-green' : 'text-muted'}`}>{outcomeLine(log)}</span>
        </div>
      </div>

      {delivery.slow && (
        <p className="mt-2.5 text-[12.5px] leading-[1.55] text-text">
          TradingView stops waiting after about 3 seconds, so its alert log may show this alert as
          “failed — timed out”.{' '}
          {traded
            ? 'It still arrived and traded, as above.'
            : 'It still arrived; what happened to it is listed below.'}
        </p>
      )}
      {!delivery.sentAt && (
        <p className="mt-2.5 text-[12px] leading-[1.55] text-muted">
          No fire time came with this signal. For a TradingView alert, add{' '}
          <code className="font-mono text-text">"sent_at": "{'{{timenow}}'}"</code> to its message to see how long it took
          to reach us.
        </p>
      )}
    </div>
  )
}

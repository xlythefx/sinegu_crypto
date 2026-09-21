import { useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  History,
  Info,
  Send,
} from 'lucide-react'
import {
  CARD,
  CARD_SUB,
  CARD_TITLE,
  HEAD,
  HEAD_L,
  ICON_CHIP,
  NOTE_EMPTY,
  NOTE_ERROR,
  NOTE_WARN,
} from './classes'
import { previewRecap } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import type {
  RecapKind,
  RecapPreviewDay,
  RecapPreviewResult,
} from '../../../types/admin'

const BTN =
  'inline-flex items-center gap-1.5 h-[38px] rounded-pill border border-border bg-surface2 px-4 text-[12.5px] font-bold text-text transition-[border-color,color,background-color] duration-150 hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 h-[38px] rounded-pill border border-accent bg-accent px-4 text-[12.5px] font-bold text-on-accent transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
const DATE_INPUT =
  'h-[38px] rounded-btn border border-border bg-surface2 px-2.5 text-[12.5px] text-text outline-none focus:border-accent'

interface PresetButton {
  id: string
  label: string
  kind: RecapKind
  on: RecapPreviewDay
  icon: typeof CalendarDays
}

/**
 * The four quick sends. "Yesterday" is a literal the ENGINE resolves in the
 * report timezone, so an admin browsing from another zone still gets the
 * Manila day the scheduler would have used.
 */
const PRESETS: PresetButton[] = [
  { id: 'daily', label: "Today's daily", kind: 'daily', on: null, icon: CalendarDays },
  { id: 'yesterday', label: "Yesterday's daily", kind: 'daily', on: 'yesterday', icon: History },
  { id: 'weekly', label: 'Weekly (to date)', kind: 'weekly', on: null, icon: CalendarRange },
  { id: 'monthly', label: 'Monthly (to date)', kind: 'monthly', on: null, icon: CalendarCheck },
]

interface RecapPreviewCardProps {
  /** From engine status — null when the engine's /health is unreachable. */
  engineReachable: boolean
}

/**
 * Recap previews: render the daily / weekly / monthly recap exactly as the
 * scheduler would and send it to the ADMIN Telegram group under a test
 * banner. Nothing reaches the public channel, and the scheduler's own state
 * is untouched, so tonight's real post is unaffected. The rendered text is
 * shown here too, so checking a figure does not mean switching to Telegram.
 */
export default function RecapPreviewCard({ engineReachable }: RecapPreviewCardProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [day, setDay] = useState('')
  const [result, setResult] = useState<RecapPreviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (id: string, kind: RecapKind, on: RecapPreviewDay) => {
    setBusy(id)
    setError(null)
    try {
      setResult(await previewRecap(kind, on))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send the preview.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={CARD} data-aos="fade-up" data-aos-delay="50">
      <div className={HEAD}>
        <div className={HEAD_L}>
          <span className={ICON_CHIP}>
            <Send size={16} />
          </span>
          <div>
            <div className={CARD_TITLE}>Recap previews</div>
            <div className={CARD_SUB}>
              Sends a test copy to the admin Telegram group — never the public channel.
            </div>
          </div>
        </div>
      </div>

      {!engineReachable ? (
        <div className={NOTE_EMPTY}>
          The engine is not reachable from here, so nothing can be rendered.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(({ id, label, kind, on, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={BTN}
                disabled={busy !== null}
                onClick={() => run(id, kind, on)}
              >
                <Icon size={14} />
                {busy === id ? 'Sending…' : label}
              </button>
            ))}
          </div>

          {/* Any past day: the daily as it would have fired at 23:55 that day. */}
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (day) run('day', 'daily', day)
            }}
          >
            <label className="text-[12.5px] text-muted" htmlFor="recap-preview-day">
              Or a specific day
            </label>
            <input
              id="recap-preview-day"
              type="date"
              className={DATE_INPUT}
              value={day}
              onChange={(e) => setDay(e.target.value)}
              disabled={busy !== null}
            />
            <button
              type="submit"
              className={BTN_PRIMARY}
              disabled={busy !== null || !day}
            >
              {busy === 'day' ? 'Sending…' : 'Send that day’s daily'}
            </button>
          </form>

          {error && (
            <div className={`mt-4 ${NOTE_ERROR}`}>
              <AlertTriangle size={15} className="flex-none mt-px" />
              <span>{error}</span>
            </div>
          )}

          {result && !error && (
            <div className="mt-4 flex flex-col gap-3">
              <div className={NOTE_WARN}>
                <Info size={15} className="flex-none mt-px" />
                <span>
                  {result.messages.length === 0
                    ? 'Nothing to send — no exchange has a published track record yet.'
                    : result.telegram
                      ? `Sent to the admin group as a test (${result.messages.length} message${result.messages.length === 1 ? '' : 's'}).`
                      : 'Rendered only — the engine has no Telegram configured here, so nothing was sent.'}
                </span>
              </div>
              {result.messages.map((m, i) => (
                <pre
                  key={i}
                  className="whitespace-pre-wrap break-words rounded-row border border-border bg-surface2 px-4 py-3 font-body text-[13px] leading-relaxed text-text"
                >
                  {m.text}
                </pre>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

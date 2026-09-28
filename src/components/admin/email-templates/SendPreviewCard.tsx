import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Mail, Send } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { getApiErrorMessage } from '../../../services/api'
import { sendEmailPreview } from '../../../services/emailTemplates'
import type { EmailTemplate } from '../../../types/emailTemplates'
import {
  BTN,
  BTN_GHOST,
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
} from '../manual-trade/classes'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Pending = { slug?: string; label: string }

/**
 * "Send me a copy" — mails "[Preview]" copies (sample data) to a reviewer so
 * the wording can be approved in a real inbox, one email or all of them.
 */
export default function SendPreviewCard({
  current,
  total,
  from,
  suggestions,
  delivers,
}: {
  current: EmailTemplate
  total: number
  from: string
  suggestions: string[]
  delivers: boolean
}) {
  const [to, setTo] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const valid = EMAIL_RE.test(to.trim())

  const run = async () => {
    if (!pending) return
    setBusy(true)
    setResult(null)
    try {
      const res = await sendEmailPreview({ to: to.trim(), slug: pending.slug })
      setResult({
        ok: true,
        text: res.delivers
          ? `Sent ${res.sent} preview ${res.sent === 1 ? 'email' : 'emails'} to ${to.trim()}.`
          : `${res.sent} written to the server log — this server does not deliver mail.`,
      })
    } catch (err) {
      setResult({ ok: false, text: getApiErrorMessage(err, 'Could not send the preview.') })
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <section className={CARD} data-aos="fade-up">
      <div className={CARD_HEAD}>
        <span className={CHIP}>
          <Mail size={15} />
        </span>
        <div className="min-w-0">
          <div className={CARD_TITLE}>Send a preview copy</div>
          <div className={CARD_SUB}>
            From {from}, marked “[Preview]”, with sample data. No customer is emailed.
          </div>
        </div>
      </div>

      {!delivers && (
        <div className={`${MSG} ${MSG_WARN} mb-3`}>
          <AlertTriangle size={15} className="flex-none mt-px" />
          <span>This server's mailer is set to log only — copies are written to its log, not delivered.</span>
        </div>
      )}

      <label className={LABEL} htmlFor="preview-to">
        Send to
      </label>
      <input
        id="preview-to"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="name@example.com"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className={INPUT}
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTo(s)}
              className="rounded-pill border border-border bg-surface2 px-2.5 py-1 text-[11.5px] text-muted cursor-pointer hover:border-accent-line hover:text-text"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 max-[420px]:grid-cols-1 gap-2 mt-4">
        <button
          type="button"
          className={`${BTN} ${BTN_PRIMARY}`}
          disabled={!valid || busy}
          onClick={() => setPending({ slug: current.slug, label: `“${current.title}”` })}
        >
          <Send size={14} /> This email
        </button>
        <button
          type="button"
          className={`${BTN} ${BTN_GHOST}`}
          disabled={!valid || busy}
          onClick={() => setPending({ label: `all ${total} emails` })}
        >
          <Send size={14} /> All {total}
        </button>
      </div>

      {result && (
        <div className={`${MSG} ${result.ok ? MSG_OK : MSG_ERR} mt-3`} role="status">
          {result.ok ? (
            <CheckCircle2 size={15} className="flex-none mt-px" />
          ) : (
            <AlertTriangle size={15} className="flex-none mt-px" />
          )}
          <span>{result.text}</span>
        </div>
      )}

      <ConfirmModal
        open={pending !== null}
        title="Send preview copies?"
        message={pending ? `Send ${pending.label} to ${to.trim()} as [Preview] copies with sample data.` : ''}
        confirmLabel={busy ? 'Sending…' : 'Yes, send'}
        onConfirm={run}
        onCancel={() => !busy && setPending(null)}
      />
    </section>
  )
}

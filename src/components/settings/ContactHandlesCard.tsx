import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, AlertTriangle, AtSign, CheckCircle2 } from 'lucide-react'
import HandleInput from '../auth/HandleInput'
import WhatsAppInput from '../auth/WhatsAppInput'
import { DiscordMark } from '../ui/BrandIcons'
import { useApiData } from '../../hooks/useApiData'
import { getApiErrorMessage } from '../../services/api'
import { getContactStatus, updateContactHandles } from '../../services/user'
import {
  CONTACTS_ANCHOR,
  TELEGRAM_REQUIRED,
  WHATSAPP_REQUIRED,
  handleError,
  normaliseDiscord,
  normaliseTelegram,
} from '../../lib/signupSources'
import { WHATSAPP_HINT, WHATSAPP_PATTERN, normaliseWhatsapp } from '../../lib/whatsapp'
import {
  BTN_PRIMARY_SM,
  CARD,
  CARD_HEAD,
  CARD_SUB,
  CARD_TITLE,
  CARD_TITLES,
  CHIP,
  HINT,
  LOADING,
  notice as noticeCls,
} from './formClasses'
import type { AuthUser } from '../../types/auth'
import type { ContactHandles, ContactStatus } from '../../types/signupInfo'

const FIELD =
  'h-10 w-full rounded-field border border-border bg-surface2 pr-3 pl-11 font-body text-[13px] text-text outline-none transition-[border-color,background] duration-150 focus:border-accent-line focus:bg-surface'


type Notice = { kind: 'success' | 'error'; text: string } | null

/**
 * Settings → how the team reaches you. Telegram and WhatsApp are REQUIRED
 * (owner, 2026-11-16): a customer missing either may not connect an exchange,
 * so this card says so at the top until both are saved, and a saved one can
 * be changed but not emptied. Discord stays optional; when it is linked
 * through "Sign in with Discord" that confirmed username is what the team
 * sees, so the typed field gives way to it. Typed, never verified.
 */
export default function ContactHandlesCard({ user }: { user: AuthUser | null }) {
  const status = useApiData(getContactStatus)
  const [telegram, setTelegram] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [discord, setDiscord] = useState('')
  const [saved, setSaved] = useState<ContactStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const sectionRef = useRef<HTMLElement>(null)

  const seed = (next: ContactStatus) => {
    setSaved(next)
    setTelegram(next.contacts.telegram ?? '')
    setWhatsapp(next.contacts.whatsapp ?? '')
    setDiscord(next.contacts.discord ?? '')
  }

  // Seed the fields once the stored values arrive.
  useEffect(() => {
    if (status.data) seed(status.data)
  }, [status.data])

  // Arrived from the dashboard's reminder: bring the card into view.
  useEffect(() => {
    if (window.location.hash !== `#${CONTACTS_ANCHOR}`) return
    const t = window.setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => window.clearTimeout(t)
  }, [])

  const linked = user?.discord?.username ?? null
  const stored: ContactHandles | null = saved?.contacts ?? null
  const tg = normaliseTelegram(telegram)
  const wa = normaliseWhatsapp(whatsapp)
  const dc = normaliseDiscord(discord)
  const dirty =
    !!stored &&
    (tg !== (stored.telegram ?? '') ||
      wa !== (stored.whatsapp ?? '') ||
      (!linked && dc !== (stored.discord ?? '')))

  const problem = (): string | null => {
    // A required one may be left empty only while it was never given.
    if (!tg && stored?.telegram) return TELEGRAM_REQUIRED
    if (!wa && stored?.whatsapp) return WHATSAPP_REQUIRED
    if (wa && !WHATSAPP_PATTERN.test(wa)) return WHATSAPP_HINT
    return handleError(telegram, linked ? null : discord)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setNotice(null)
    const bad = problem()
    if (bad) {
      setNotice({ kind: 'error', text: bad })
      return
    }
    setBusy(true)
    try {
      const next = await updateContactHandles({
        // Absent = unchanged: an empty required field that was never given is simply not sent.
        ...(tg ? { telegram: tg } : {}),
        ...(wa ? { whatsapp: wa } : {}),
        // A linked Discord is not ours to overwrite here.
        ...(linked ? {} : { discord: dc || null }),
      })
      seed(next)
      setNotice({
        kind: 'success',
        text: next.missing.length ? 'Saved.' : 'Saved — our team can reach you now.',
      })
    } catch (err) {
      setNotice({ kind: 'error', text: getApiErrorMessage(err, 'Could not save your contact details.') })
    } finally {
      setBusy(false)
    }
  }

  const missing = saved?.missing ?? []

  return (
    <section
      id={CONTACTS_ANCHOR}
      ref={sectionRef}
      className={`${CARD} mb-4 flex scroll-mt-24 flex-col`}
      data-aos="fade-up"
    >
      <div className={CARD_HEAD}>
        <span className={CHIP}>
          <AtSign size={15} />
        </span>
        <div className={CARD_TITLES}>
          <h3 className={CARD_TITLE}>Telegram, WhatsApp &amp; Discord</h3>
          <p className={CARD_SUB}>How our team reaches you — Telegram and WhatsApp are required</p>
        </div>
      </div>

      {missing.length > 0 && (
        <div className={noticeCls('warn').replace('mt-3.5', 'mb-3')} role="status">
          <AlertTriangle size={15} />
          <span>
            {missing.length === 2
              ? 'Add your Telegram username and WhatsApp number.'
              : missing[0] === 'telegram'
                ? 'Add your Telegram username.'
                : 'Add your WhatsApp number.'}
            {saved?.connect_locked ? ' You need both before you can connect an exchange.' : ''}
          </span>
        </div>
      )}

      {notice && (
        <div className={noticeCls(notice.kind)} role="status">
          {notice.kind === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{notice.text}</span>
        </div>
      )}

      {status.loading && !saved ? (
        <p className={LOADING}>Loading…</p>
      ) : status.error && !saved ? (
        <p className="text-[12.5px] text-red">
          {getApiErrorMessage(status.error, 'Could not load your contact details.')}
        </p>
      ) : (
        <form className="flex flex-col gap-2.5" onSubmit={submit}>
          <div className="grid grid-cols-2 items-start gap-2.5 max-[820px]:grid-cols-1">
            <HandleInput platform="telegram" value={telegram} onChange={setTelegram} fieldClass={FIELD} required />
            <WhatsAppInput value={whatsapp} onChange={setWhatsapp} size="sm" />
          </div>
          <div className="grid grid-cols-[1fr_auto] items-start gap-2.5 max-[820px]:grid-cols-1">
            {linked ? (
              <div className="flex h-10 min-w-0 items-center gap-2.5 rounded-field border border-border bg-surface2 px-3 text-[13px]">
                <span className="text-[#5865F2]">
                  <DiscordMark size={17} />
                </span>
                <span className="truncate font-mono font-bold">@{linked}</span>
                <span className="ml-auto shrink-0 text-[11px] text-faint">connected</span>
              </div>
            ) : (
              <HandleInput platform="discord" value={discord} onChange={setDiscord} fieldClass={FIELD} />
            )}
            <button type="submit" className={`${BTN_PRIMARY_SM} h-10`} disabled={busy || !dirty}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p className={HINT}>
            {linked
              ? 'Discord is optional and comes from Sign in with Discord — manage it in the Discord card below.'
              : 'Discord is optional.'}
          </p>
        </form>
      )}
    </section>
  )
}

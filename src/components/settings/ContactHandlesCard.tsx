import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, AtSign, CheckCircle2 } from 'lucide-react'
import { HandleInput } from '../auth/ContactHandleFields'
import { DiscordMark } from '../ui/BrandIcons'
import { useApiData } from '../../hooks/useApiData'
import { getApiErrorMessage } from '../../services/api'
import { getContactHandles, updateContactHandles } from '../../services/user'
import { handleError, normaliseDiscord, normaliseTelegram } from '../../lib/signupSources'
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
import type { ContactHandles } from '../../types/signupInfo'

const FIELD =
  'h-10 w-full rounded-field border border-border bg-surface2 pr-3 pl-11 font-body text-[13px] text-text outline-none transition-[border-color,background] duration-150 focus:border-accent-line focus:bg-surface'

type Notice = { kind: 'success' | 'error'; text: string } | null

/**
 * Settings → Telegram & Discord: the optional usernames asked at sign-up,
 * added or changed here. Typed, not verified. When Discord is linked through
 * "Sign in with Discord" that confirmed username is what the team sees, so
 * the typed Discord field gives way to it (and only Telegram is saved).
 */
export default function ContactHandlesCard({ user }: { user: AuthUser | null }) {
  const contacts = useApiData(getContactHandles)
  const [telegram, setTelegram] = useState('')
  const [discord, setDiscord] = useState('')
  const [saved, setSaved] = useState<ContactHandles | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  // Seed the fields once the stored values arrive.
  useEffect(() => {
    if (!contacts.data) return
    setSaved(contacts.data)
    setTelegram(contacts.data.telegram ?? '')
    setDiscord(contacts.data.discord ?? '')
  }, [contacts.data])

  const linked = user?.discord?.username ?? null
  const tg = normaliseTelegram(telegram)
  const dc = normaliseDiscord(discord)
  const dirty =
    !!saved && (tg !== (saved.telegram ?? '') || (!linked && dc !== (saved.discord ?? '')))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setNotice(null)
    const problem = handleError(telegram, linked ? null : discord)
    if (problem) {
      setNotice({ kind: 'error', text: problem })
      return
    }
    setBusy(true)
    try {
      const next = await updateContactHandles({
        telegram: tg || null,
        // Absent = unchanged: a linked Discord is not ours to overwrite here.
        ...(linked ? {} : { discord: dc || null }),
      })
      setSaved(next)
      setTelegram(next.telegram ?? '')
      setDiscord(next.discord ?? '')
      setNotice({ kind: 'success', text: 'Saved.' })
    } catch (err) {
      setNotice({ kind: 'error', text: getApiErrorMessage(err, 'Could not save your usernames.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`${CARD} mb-4 flex flex-col`} data-aos="fade-up">
      <div className={CARD_HEAD}>
        <span className={CHIP}>
          <AtSign size={15} />
        </span>
        <div className={CARD_TITLES}>
          <h3 className={CARD_TITLE}>Telegram &amp; Discord</h3>
          <p className={CARD_SUB}>Optional — so our team can reach you where you already are</p>
        </div>
      </div>

      {notice && (
        <div className={noticeCls(notice.kind)} role="status">
          {notice.kind === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{notice.text}</span>
        </div>
      )}

      {contacts.loading && !saved ? (
        <p className={LOADING}>Loading…</p>
      ) : contacts.error && !saved ? (
        <p className="text-[12.5px] text-red">
          {getApiErrorMessage(contacts.error, 'Could not load your usernames.')}
        </p>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-2.5 max-[820px]:grid-cols-1">
            <HandleInput platform="telegram" value={telegram} onChange={setTelegram} fieldClass={FIELD} />
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
          {linked && (
            <p className={HINT}>
              Your Discord comes from Sign in with Discord — manage it in the Discord card below.
            </p>
          )}
        </form>
      )}
    </section>
  )
}

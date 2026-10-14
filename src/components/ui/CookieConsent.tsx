import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'
import {
  CONSENT_OPEN_EVENT,
  readConsent,
  saveConsent,
  type ConsentChoice,
} from '../../lib/consent'

const BTN =
  // Side by side, sharing the row; stacked full-width on the narrowest phones
  // (`flex-1` in a column would collapse the height to nothing).
  'inline-flex h-10 min-[381px]:flex-1 max-[380px]:w-full items-center justify-center rounded-btn px-4 text-[13px] font-bold transition-colors duration-150 cursor-pointer whitespace-nowrap'

/**
 * The consent banner: shown on a visitor's first page view (any page) until
 * they choose, and again whenever something calls `openConsentBanner()` (the
 * footer's "Privacy choices", the Privacy Policy). What each choice changes is
 * written in `lib/consent.ts` — the text below must keep saying exactly that.
 */
export default function CookieConsent() {
  const [open, setOpen] = useState(() => readConsent() === null)

  useEffect(() => {
    const reopen = () => setOpen(true)
    window.addEventListener(CONSENT_OPEN_EVENT, reopen)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen)
  }, [])

  if (!open) return null

  const choose = (choice: ConsentChoice) => {
    saveConsent(choice)
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Privacy choices"
      className="fixed right-4 bottom-4 left-4 z-[9000] mx-auto max-w-[560px] animate-[fadeup_0.35s_ease-out] rounded-card border border-border bg-surface p-5 shadow-[0_18px_48px_rgba(0,0,0,0.35)] max-[480px]:right-3 max-[480px]:bottom-3 max-[480px]:left-3 max-[480px]:p-4"
    >
      <div className="mb-2 flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-btn border border-accent-line bg-accent-soft text-accent">
          <Cookie size={16} />
        </span>
        <h2 className="m-0 font-display text-[16px] font-extrabold tracking-[-0.01em]">
          Your privacy
        </h2>
      </div>
      <p className="m-0 text-[13px] leading-[1.6] text-muted">
        We keep a few essentials in your browser to sign you in and remember your theme. When
        you sign up or sign in, we record your IP address, country and device to keep accounts
        secure. With <span className="font-semibold text-text">Accept all</span> we also note
        your time zone, language and screen size, to understand who uses Pixel Alpha. No ads, no
        tracking scripts.{' '}
        <Link to="/privacy#cookies" className="font-semibold text-text hover:underline">
          Privacy Policy
        </Link>
      </p>
      <div className="mt-4 flex gap-2.5 max-[380px]:flex-col">
        <button
          type="button"
          className={`${BTN} border border-border bg-surface2 text-text hover:border-accent-line hover:bg-accent-soft`}
          onClick={() => choose('essential')}
        >
          Essentials only
        </button>
        <button
          type="button"
          className={`${BTN} border-0 bg-accent text-on-accent hover:opacity-90`}
          onClick={() => choose('all')}
        >
          Accept all
        </button>
      </div>
    </div>
  )
}

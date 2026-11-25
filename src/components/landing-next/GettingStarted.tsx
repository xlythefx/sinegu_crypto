import { Link } from 'react-router-dom'
import { useSessionUser } from '../../hooks/useSessionUser'
import { REGISTER_PATH, SIGN_IN_PATH } from '../../lib/routes'
import { MIN_DEPOSIT_USDT } from '../../lib/pricing'
import { SUPPORT_EMAIL, SUPPORT_TELEGRAM_HANDLE, SUPPORT_TELEGRAM_URL } from '../../lib/company'
import PixelIcon from './PixelIcon'
import type { PixelGlyph } from './pixelGlyphs'
import { BTN_PRIMARY, CONTAINER, H2, LEAD } from './layout'

interface Step {
  glyph: PixelGlyph
  title: string
  body: string
  link?: { to: string; label: string }
}

/**
 * The steps a new customer actually walks, in order, each one a rule the API
 * enforces: the contacts the sign-up requires (Telegram + WhatsApp since
 * 2026-11-16), the e-mail code, manual approval (`status = pending`), the
 * deposit gate. It replaces "Take the other side of the market" and "switch
 * on your first bot in minutes", which promised a speed the approval queue
 * does not have.
 */
const STEPS: Step[] = [
  {
    glyph: 'user',
    title: 'Create your account',
    body: 'Your name, e-mail and password, plus your Telegram and WhatsApp so we can reach you. Confirm the e-mail with the 6-digit code we send.',
  },
  {
    glyph: 'check',
    title: 'We approve it',
    body: 'Our team reviews every new account by hand. You get an e-mail as soon as yours is approved.',
  },
  {
    glyph: 'key',
    title: 'Connect Binance',
    body: `Create a trade-only API key on Binance and paste it in. The bot starts once your futures wallet has received at least ${MIN_DEPOSIT_USDT.toLocaleString('en-US')} USDT in deposits.`,
    link: { to: '/docs/binance', label: 'Step-by-step Binance guide' },
  },
  {
    glyph: 'bolt',
    title: 'The next signal trades',
    body: 'Positions open on your account by themselves. Follow them in your dashboard or the Binance app, and disconnect the key whenever you want to stop.',
  },
]

export default function GettingStarted() {
  const user = useSessionUser()
  return (
    <section className="border-t border-hair bg-surface2">
      <div className={`${CONTAINER} py-20 grid grid-cols-[1.15fr_0.85fr] gap-14 items-start max-[960px]:grid-cols-1 max-[960px]:gap-10 max-[560px]:py-14`}>
        <div data-aos="fade-up">
          <h2 className={`${H2} mb-10`}>What happens after you sign up</h2>
          <ol>
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex gap-5 pb-8 last:pb-0">
                {i < STEPS.length - 1 && (
                  <svg aria-hidden="true" className="absolute left-[23px] top-14 bottom-1 w-[2px] h-[calc(100%-60px)]" preserveAspectRatio="none">
                    <line x1="1" y1="0" x2="1" y2="100%" stroke="var(--border)" strokeWidth={2} strokeDasharray="4 4" />
                  </svg>
                )}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn border border-border bg-surface text-accent">
                  <PixelIcon glyph={step.glyph} size={24} />
                </div>
                <div className="pt-1">
                  <h3 className="font-display text-[18px] font-bold mb-1.5">
                    <span className="font-mono text-[13px] text-faint mr-2">{i + 1}.</span>
                    {step.title}
                  </h3>
                  <p className="text-[14.5px] leading-[1.6] text-muted max-w-[56ch]">{step.body}</p>
                  {step.link && (
                    <Link to={step.link.to} className="inline-block text-[14px] font-semibold mt-2 underline underline-offset-4">
                      {step.link.label}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-surface border border-border rounded-card p-7 max-[560px]:p-5 min-[961px]:sticky min-[961px]:top-6" data-aos="fade-up" data-aos-delay={100}>
          <h3 className="font-display text-[22px] font-bold mb-3">
            {user ? 'You already have an account' : 'Start with an account'}
          </h3>
          <p className={`${LEAD} text-[15px]! mb-6`}>
            Signing up is free. Nothing is billed until a month ends with your
            account at a new high.
          </p>
          {user ? (
            <Link to="/dashboard" className={`${BTN_PRIMARY} w-full no-underline`}>Open your dashboard</Link>
          ) : (
            <>
              <Link to={REGISTER_PATH} className={`${BTN_PRIMARY} w-full no-underline`}>Create an account</Link>
              <p className="text-[13.5px] text-muted text-center mt-3">
                Already registered? <Link to={SIGN_IN_PATH} className="font-semibold">Sign in</Link>
              </p>
            </>
          )}
          <div className="border-t border-hair mt-6 pt-5 text-[13.5px] leading-[1.6] text-muted">
            Questions first? Write to{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold">{SUPPORT_EMAIL}</a>{' '}
            or{' '}
            <a href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="font-semibold">
              {SUPPORT_TELEGRAM_HANDLE}
            </a>{' '}
            on Telegram.
          </div>
        </div>
      </div>
    </section>
  )
}

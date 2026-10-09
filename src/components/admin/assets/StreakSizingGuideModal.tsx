import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, X } from 'lucide-react'
import { scalePreview } from '../../../lib/streakSizing'
import { fmtQty } from '../../../lib/format'

/*
 * The long explanation of streak sizing, opened from "Get to know more" on the
 * Streak Sizing Settings tab. The cards stay about the asset in front of you;
 * everything that needs an example — gaps carrying, what counts as a win, how
 * a size grows with an account's balance — lives here, worked through ONE
 * fixed example so nothing on screen can be mistaken for a real setting.
 */

/** The worked example every section uses: base 5, two loss steps, one win step. */
const EXAMPLE = { base: 5, loss: [{ n: 2, size: 3 }, { n: 5, size: 2 }], win: [{ n: 3, size: 7 }] }

const RUN_TABLE: { run: string; size: number; why: string }[] = [
  { run: '1 loss in a row', size: 5, why: 'no step at 1 loss → normal size' },
  { run: '2 – 4 losses in a row', size: 3, why: 'the "after 2 losses" step' },
  { run: '5 or more losses', size: 2, why: 'the deepest loss step keeps applying' },
  { run: '1 – 2 wins in a row', size: 5, why: 'no step yet → normal size' },
  { run: '3 or more wins', size: 7, why: 'the "after 3 wins" step' },
]

const BALANCES = [1000, 3000, 10000] as const

const BALANCE_ROWS: { label: string; size: number }[] = [
  { label: 'Normal', size: EXAMPLE.base },
  { label: 'After 2 losses', size: EXAMPLE.loss[0].size },
  { label: 'After 5 losses', size: EXAMPLE.loss[1].size },
  { label: 'After 3 wins', size: EXAMPLE.win[0].size },
]

const GOOD_TO_KNOW = [
  'Each account counts its own trades on that coin, long and short together.',
  'A position that was added to several times and closes together counts as one trade.',
  'Any profit after fees is a win. Break-even or worse is a loss.',
  'A new account, or one with no closed trade on the coin yet, uses the normal size.',
  'If the trade history cannot be read when a signal arrives, the bot uses the normal size.',
  'Only new entries change. Closing a position is never affected.',
  'The asset’s max position size still caps every position: with a base of 5 and a max of 15, two entries of 7 make 14, so a third is refused.',
]

const SECTION_TITLE = 'font-display text-[14px] font-extrabold text-text'
const BODY = 'text-[13px] leading-[1.6] text-muted'

export default function StreakSizingGuideModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [balance, setBalance] = useState<number>(3000)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // Portaled: the tab's cards are AOS nodes (transformed), which would trap a
  // position: fixed overlay rendered inside them.
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-[rgba(0,0,0,0.55)] p-4 backdrop-blur-[3px] animate-[fadeup_0.2s_ease_both]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-guide-title"
    >
      <div
        className="flex max-h-[min(88vh,760px)] w-full max-w-[560px] flex-col rounded-[20px] border border-border bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.35)] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-hair px-5 pb-4 pt-5 sm:px-6">
          <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent-soft text-accent">
            <HelpCircle size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="streak-guide-title" className="font-display text-[18px] font-extrabold tracking-[-0.01em]">
              How streak sizing works
            </h2>
            <p className="mt-0.5 text-[12.5px] text-faint">One example, start to finish.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-btn border border-border text-muted transition-colors duration-150 hover:text-text"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5 sm:px-6">
          <section className="flex flex-col gap-2">
            <h3 className={SECTION_TITLE}>What it does</h3>
            <p className={BODY}>
              After a number of losing — or winning — trades in a row on a coin, the bot opens
              that account’s next trade at a size you choose instead of the normal size. You set
              each step yourself: for example “after 2 losses in a row → 3”.
            </p>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className={SECTION_TITLE}>Example</h3>
            <p className={BODY}>
              Normal size <b className="text-text">5</b>. Steps: after 2 losses →{' '}
              <b className="text-text">3</b>, after 5 losses → <b className="text-text">2</b>,
              after 3 wins → <b className="text-text">7</b>.
            </p>
            <div className="overflow-hidden rounded-row border border-border">
              {RUN_TABLE.map((row, i) => (
                <div
                  key={row.run}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3.5 py-2.5 ${
                    i > 0 ? 'border-t border-hair' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block text-[13px] font-semibold text-text">{row.run}</span>
                    <span className="block text-[11.5px] text-faint">{row.why}</span>
                  </div>
                  <span className="font-mono text-[15px] font-bold text-text">{row.size}</span>
                </div>
              ))}
            </div>
            <p className={BODY}>
              Only the current run counts: a win ends a losing run and a loss ends a winning one.
              A step left out simply keeps the size of the step before it. With no win steps, any
              win goes straight back to the normal size.
            </p>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className={SECTION_TITLE}>Bigger accounts trade more</h3>
            <p className={BODY}>
              Every size you type is per 1,000 USDT of balance, just like Base size. Pick an
              account size to see what the same example trades:
            </p>
            <div
              className="inline-flex w-fit rounded-pill border border-border bg-surface2 p-0.5"
              role="radiogroup"
              aria-label="Example account balance"
            >
              {BALANCES.map((b) => {
                const on = b === balance
                return (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setBalance(b)}
                    className={`min-h-[30px] rounded-pill px-3 font-mono text-[12px] font-semibold transition-colors duration-150 ${
                      on ? 'bg-accent text-on-accent' : 'text-muted hover:text-text'
                    }`}
                  >
                    {fmtQty(b, 0, 0)} USDT
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BALANCE_ROWS.map((row) => (
                <div key={row.label} className="rounded-row border border-border bg-surface2 px-3 py-2.5">
                  <span className="block text-[11px] text-faint">{row.label}</span>
                  <span className="mt-0.5 block font-mono text-[15px] font-bold text-text">
                    {fmtQty(scalePreview('LTCUSDT', row.size, balance), 0, 4)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11.5px] leading-[1.55] text-faint">
              An account below 1,000 USDT trades the sizes exactly as typed.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className={SECTION_TITLE}>Good to know</h3>
            <ul className="flex flex-col gap-2">
              {GOOD_TO_KNOW.map((line) => (
                <li key={line} className={`flex items-start gap-2 ${BODY}`}>
                  <span className="mt-[8px] h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex justify-end border-t border-hair px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill bg-accent px-[22px] py-[10px] text-[14px] font-bold text-on-accent shadow-[0_10px_24px_var(--glow)]"
            autoFocus
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

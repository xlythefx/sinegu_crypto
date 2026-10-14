import { ArrowLeft, ArrowRight } from 'lucide-react'

const BACK =
  'inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-border bg-surface2 px-5 font-body text-[14px] font-bold text-text transition-[border-color,background] duration-200 hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60'
const NEXT =
  'relative inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-[12px] border-0 bg-accent font-body text-[15px] font-bold text-on-accent shadow-[0_10px_24px_var(--glowAuth)] transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60'

interface Props {
  /** Omitted on the first step. */
  onBack?: () => void
  nextLabel: string
  busy?: boolean
  /** The last step creates the account: no arrow, it is not "next". */
  final?: boolean
}

/**
 * Back + Continue under every step. Continue is the form's submit button, so
 * Enter in a field moves on exactly as the click does.
 */
export default function WizardNav({ onBack, nextLabel, busy = false, final = false }: Props) {
  return (
    <div className="mt-2 flex gap-2.5">
      {onBack && (
        <button type="button" className={BACK} onClick={onBack} disabled={busy}>
          <ArrowLeft size={16} />
          Back
        </button>
      )}
      <button type="submit" className={NEXT} disabled={busy}>
        {busy ? 'Please wait…' : nextLabel}
        {!busy && !final && <ArrowRight size={16} />}
      </button>
    </div>
  )
}

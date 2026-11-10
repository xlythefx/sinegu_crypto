import { useEffect, useState, type FormEvent } from 'react'
import { CircleAlert, Info } from 'lucide-react'
import { BTN_GHOST, BTN_PRIMARY, FIELD, HINT, INPUT, LABEL } from '../../../settings/formClasses'
import { creativeErrorMessage, fmtBudget } from '../../../../lib/creatives'
import { updateCreativeBudget } from '../../../../services/creatives'
import type { CreativeBudget } from '../../../../types/creatives'
import CreativeModal from '../CreativeModal'
import { NOTICE } from '../creativeClasses'

interface BudgetCapModalProps {
  open: boolean
  budget: CreativeBudget
  onClose: () => void
  onSaved: (budget: CreativeBudget) => void
}

const CAP_MAX = 10_000

/**
 * Change the monthly cap (full admins only — the API refuses anyone else).
 * The form states the change before → after, so saving is the confirmation.
 */
export default function BudgetCapModal({ open, budget, onClose, onSaved }: BudgetCapModalProps) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setValue(String(budget.cap_usd))
    setError(null)
    setSaving(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const cap = value.trim() === '' ? NaN : Number(value)
  const valid = Number.isFinite(cap) && cap >= 0 && cap <= CAP_MAX
  const rounded = valid ? Math.round(cap * 100) / 100 : 0
  const unchanged = valid && rounded === budget.cap_usd

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) {
      setError(`Enter an amount from $0 to ${fmtBudget(CAP_MAX)}.`)
      return
    }
    if (unchanged) {
      onClose()
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateCreativeBudget(rounded))
      onClose()
    } catch (err) {
      setError(creativeErrorMessage(err, 'Could not change the cap.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <CreativeModal
      open={open}
      title="Change the monthly cap"
      subtitle={`The most the team may spend on Higgsfield in one calendar month (UTC). ${fmtBudget(budget.spent_usd)} is already spent this month.`}
      onClose={onClose}
      maxWidth={460}
    >
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <label className={FIELD}>
          <span className={LABEL}>Cap in US dollars</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={CAP_MAX}
            step={0.01}
            className={`${INPUT} font-mono`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
            autoFocus
          />
          <span className={HINT}>From $0 to {fmtBudget(CAP_MAX)}.</span>
        </label>

        <p className={NOTICE.info}>
          <Info size={15} aria-hidden="true" />
          0 switches generating off for everyone until the cap is raised again. Planning keeps working.
        </p>

        {valid && !unchanged && (
          <p className="text-[13px] leading-[1.55] text-muted">
            From <strong className="font-semibold text-text">{fmtBudget(budget.cap_usd)}</strong> to{' '}
            <strong className="font-semibold text-text">{fmtBudget(rounded)}</strong>
            {rounded < budget.spent_usd && ' — less than is already spent, so nothing more can be generated this month.'}
          </p>
        )}

        {error && (
          <p className={NOTICE.error} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2.5 border-t border-hair pt-4">
          <button type="button" className={BTN_GHOST} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={BTN_PRIMARY} disabled={saving || !valid}>
            {saving ? 'Saving…' : 'Save cap'}
          </button>
        </div>
      </form>
    </CreativeModal>
  )
}

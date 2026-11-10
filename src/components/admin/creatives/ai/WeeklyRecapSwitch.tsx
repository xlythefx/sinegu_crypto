import { useState } from 'react'
import { CalendarClock, CircleAlert, LoaderCircle, Lock } from 'lucide-react'
import { creativeAiErrorMessage, AI_NOT_CONNECTED } from '../../../../lib/creativesAi'
import { updateCreativeAiSettings } from '../../../../services/creatives'
import type { CreativeAiMeta } from '../../../../types/creatives'

interface WeeklyRecapSwitchProps {
  ai: CreativeAiMeta
  /** Full admins (`can_edit_budget`); collaborators see the state read-only. */
  canEdit: boolean
  onAi: (ai: CreativeAiMeta) => void
}

/**
 * "Draft a weekly recap every Saturday": just after the Friday Telegram
 * recap, Claude files a written "Weekly recap" plan in Idea from the week's
 * public results. A full admin switches it; everyone else sees whether it is on.
 */
export default function WeeklyRecapSwitch({ ai, canEdit, onAi }: WeeklyRecapSwitchProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const on = ai.weekly_recap

  const toggle = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      onAi(await updateCreativeAiSettings(!on))
    } catch (err) {
      setError(creativeAiErrorMessage(err, 'Could not change the weekly recap.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-row border border-hair bg-surface2/60 px-3.5 py-3 sm:px-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2.5 sm:items-center">
        <span
          className="grid h-8 w-8 flex-none place-items-center rounded-[10px] border border-accent-line bg-accent-soft text-accent"
          aria-hidden="true"
        >
          <CalendarClock size={15} />
        </span>
        <div className="min-w-[200px] flex-1">
          <p className="text-[13px] font-bold text-text">Draft a weekly recap every Saturday</p>
          <p className="mt-0.5 text-[12px] leading-[1.5] text-muted">
            Just after midnight (Manila time), right after the Friday Telegram recap, Claude files a written
            “Weekly recap” plan in Idea from the week’s public results — ready to check.
            {!ai.configured && ` ${AI_NOT_CONNECTED}, so none is drafted until it is.`}
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Draft a weekly recap every Saturday"
            className="inline-flex min-h-9 flex-none cursor-pointer items-center gap-2 rounded-pill bg-transparent py-1 pl-2 disabled:cursor-not-allowed disabled:opacity-50 max-sm:ml-auto"
            onClick={() => void toggle()}
            disabled={saving}
          >
            {saving && <LoaderCircle size={13} className="animate-spin text-muted" aria-hidden="true" />}
            <span className={`text-[12.5px] font-semibold ${on ? 'text-accent' : 'text-muted'}`}>{on ? 'On' : 'Off'}</span>
            <span
              className={`relative inline-block h-5 w-9 flex-none rounded-pill border transition-[background,border-color] duration-150 ${
                on ? 'border-accent bg-accent-soft' : 'border-border bg-surface'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-[14px] w-[14px] rounded-full transition-[transform,background] duration-150 ${
                  on ? 'translate-x-4 bg-accent' : 'bg-muted'
                }`}
              />
            </span>
          </button>
        ) : (
          <span
            className="inline-flex flex-none items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-[12px] font-semibold text-muted max-sm:ml-auto"
            title="Only a full admin can change this"
          >
            <Lock size={12} aria-hidden="true" />
            {on ? 'On' : 'Off'} · a full admin can change it
          </span>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-[12px] font-semibold leading-[1.45] text-red" role="alert">
          <CircleAlert size={13} aria-hidden="true" className="mt-px flex-none" />
          {error}
        </p>
      )}
    </div>
  )
}

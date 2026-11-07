import { AlertCircle, CircleDot, Loader2 } from 'lucide-react'
import { BTN_PRIMARY, BTN_SECONDARY } from './editorClasses'
import type { DraftProblem } from '../../../../lib/assetDraft'

interface EditorActionBarProps {
  creating: boolean
  saving: boolean
  changed: boolean
  /** Shown once a save was tried; empty = nothing to fix. */
  problems: DraftProblem[]
  showProblems: boolean
  onCancel: () => void
  /** Scrolls to and opens the first problem's section. */
  onShowProblem: (problem: DraftProblem) => void
}

/**
 * The page's save bar, stuck to the bottom of the screen while the form
 * scrolls: what state the draft is in (nothing changed / unsaved / N to fix)
 * on the left, Cancel and Save on the right. Sticky, not fixed, so it never
 * sits over the last section.
 */
export default function EditorActionBar({
  creating,
  saving,
  changed,
  problems,
  showProblems,
  onCancel,
  onShowProblem,
}: EditorActionBarProps) {
  const blocked = showProblems && problems.length > 0

  let status
  if (blocked) {
    status = (
      <button
        type="button"
        onClick={() => onShowProblem(problems[0])}
        className="flex min-w-0 cursor-pointer items-center gap-2 text-left text-[12.5px] font-semibold text-red underline-offset-2 hover:underline"
      >
        <AlertCircle size={15} className="flex-none" aria-hidden="true" />
        <span className="truncate">
          {problems.length === 1 ? problems[0].message : `${problems.length} things to fix · ${problems[0].message}`}
        </span>
      </button>
    )
  } else if (creating || changed) {
    status = (
      <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-semibold text-accent">
        <CircleDot size={14} className="flex-none" aria-hidden="true" />
        <span className="truncate">{creating ? 'New coin, not saved yet' : 'Unsaved changes'}</span>
      </span>
    )
  } else {
    status = <span className="text-[12.5px] text-faint">No changes yet</span>
  }

  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-stack border-t border-border bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-6 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-[220px]" aria-live="polite">
          {status}
        </div>
        <div className="flex flex-none gap-2.5">
          <button type="button" className={BTN_SECONDARY} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className={BTN_PRIMARY}
            disabled={saving || (!creating && !changed)}
            title={!creating && !changed ? 'Nothing to save yet' : undefined}
          >
            {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : creating ? 'Create coin' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

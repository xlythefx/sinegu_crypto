import { Check, CircleAlert, ListPlus, LoaderCircle, Sparkles } from 'lucide-react'
import type { CreativeAiIdea } from '../../../../types/creatives'
import { FormatPill, PlatformPill } from '../PlatformPill'
import { BTN_SOFT } from '../creativeClasses'

/** Where "Add to planner" stands for one idea. */
export type IdeaSaveState = { status: 'saving' } | { status: 'added' } | { status: 'failed'; message: string }

interface IdeaCardProps {
  idea: CreativeAiIdea
  save: IdeaSaveState | undefined
  /** Another idea is being saved, or Claude is writing a new list. */
  locked: boolean
  onAdd: () => void
  onWrite: () => void
}

/**
 * One suggested post: where it goes, its title, the hook that opens it and
 * why it could work. "Add to planner" files it as an idea (title + hook);
 * "Write it" opens a new plan ready for Claude to draft it in full.
 */
export default function IdeaCard({ idea, save, locked, onAdd, onWrite }: IdeaCardProps) {
  const added = save?.status === 'added'
  const saving = save?.status === 'saving'

  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-row border border-border bg-surface2 p-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <PlatformPill platform={idea.platform} />
        <FormatPill format={idea.format} />
      </div>
      <h4 className="break-words text-[13.5px] font-bold leading-[1.4] text-text">{idea.title}</h4>
      {idea.hook && (
        <p className="break-words border-l-2 border-accent-line pl-2.5 text-[12.5px] leading-[1.55] text-text">
          “{idea.hook}”
        </p>
      )}
      {idea.why && <p className="break-words text-[12px] leading-[1.55] text-muted">{idea.why}</p>}

      {save?.status === 'failed' && (
        <p className="flex items-start gap-1.5 text-[12px] font-semibold leading-[1.45] text-red" role="alert">
          <CircleAlert size={13} aria-hidden="true" className="mt-px flex-none" />
          {save.message}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-1 min-[420px]:flex-row min-[420px]:flex-wrap">
        <button type="button" className={`${BTN_SOFT} min-[420px]:flex-1`} onClick={onAdd} disabled={added || saving || locked}>
          {added ? (
            <Check size={14} aria-hidden="true" className="text-green" />
          ) : saving ? (
            <LoaderCircle size={14} aria-hidden="true" className="animate-spin" />
          ) : (
            <ListPlus size={14} aria-hidden="true" />
          )}
          {added ? 'Added as an idea' : saving ? 'Adding…' : 'Add to planner'}
        </button>
        <button type="button" className={`${BTN_SOFT} min-[420px]:flex-1`} onClick={onWrite} disabled={saving || locked}>
          <Sparkles size={14} aria-hidden="true" className="text-accent" />
          Write it
        </button>
      </div>
    </article>
  )
}

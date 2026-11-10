import { NotebookPen, TriangleAlert, Undo2 } from 'lucide-react'
import { fmtCost } from '../../../../lib/creatives'
import { factsLines } from '../../../../lib/creativesAi'
import type { CreativeAiDraftResult } from '../../../../types/creatives'
import { BTN_SOFT, FACT_LABEL, NOTICE } from '../creativeClasses'
import AiDraftPill from './AiDraftPill'

interface AiDraftResultProps {
  result: CreativeAiDraftResult
  /** The fields can still go back to what they were before this draft. */
  canUndo: boolean
  onUndo: () => void
  notesAdded: boolean
  onAddNotes: () => void
}

/**
 * What came back with a draft, so it reads as a draft to CHECK: the server's
 * warnings (a figure that is not in the week's results, a caption over the
 * platform's limit) in amber, Claude's own notes, every figure it quotes,
 * the public figures it was allowed to use, and what it cost.
 */
export default function AiDraftResult({ result, canUndo, onUndo, notesAdded, onAddNotes }: AiDraftResultProps) {
  const { draft, facts_used: facts, cost_usd: cost } = result
  const notes = draft.notes.trim()
  const lines = facts ? factsLines(facts) : []

  return (
    <div className="flex min-w-0 flex-col gap-3.5 rounded-row border border-border bg-surface p-3.5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <AiDraftPill />
          <span className="flex-none font-mono text-[11.5px] text-muted">Cost {fmtCost(cost)}</span>
        </div>
        <p className="text-[12.5px] font-semibold leading-[1.5] text-text">
          Filled in below — read it and fix anything before you save.
        </p>
      </div>

      {draft.warnings.length > 0 && (
        <div className={NOTICE.warn} role="alert">
          <TriangleAlert size={15} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Check this before posting</p>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 font-medium">
              {draft.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {notes && (
        <div>
          <p className={FACT_LABEL}>Claude’s notes</p>
          <p className="mt-1 whitespace-pre-line text-[12.5px] leading-[1.55] text-text">{notes}</p>
        </div>
      )}

      <div>
        <p className={FACT_LABEL}>Figures it quotes</p>
        {draft.numbers_used.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {draft.numbers_used.map((n, i) => (
              <span
                key={`${n}-${i}`}
                className="rounded-pill border border-border bg-surface2 px-2 py-[2px] font-mono text-[11.5px] text-text"
              >
                {n}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">None — the draft quotes no results.</p>
        )}
      </div>

      <div>
        <p className={FACT_LABEL}>
          {facts?.available && facts.period ? `Public results it could use · ${facts.period}` : 'Public results it could use'}
        </p>
        {!facts ? (
          <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
            None — “Use this week’s results” was off, so it should quote no figures.
          </p>
        ) : !facts.available ? (
          <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
            Nothing was published{facts.period ? ` for ${facts.period}` : ' for this week'}, so it was told to quote no
            figures.
          </p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-1">
            {lines.map((line) => (
              <li key={line} className="flex items-start gap-2 text-[12.5px] leading-[1.5] text-text">
                <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-[11.5px] leading-[1.5] text-faint">
          The same figures Pixel Alpha already posts in its Telegram recaps — never dollar amounts or names.
        </p>
      </div>

      {(notes || canUndo) && (
        <div className="flex flex-col gap-2 border-t border-hair pt-3 sm:flex-row sm:flex-wrap">
          {notes && (
            <button type="button" className={BTN_SOFT} onClick={onAddNotes} disabled={notesAdded}>
              <NotebookPen size={14} aria-hidden="true" />
              {notesAdded ? 'Added to the plan’s notes' : 'Add these notes to the plan'}
            </button>
          )}
          {canUndo && (
            <button type="button" className={BTN_SOFT} onClick={onUndo}>
              <Undo2 size={14} aria-hidden="true" />
              Put back what was there
            </button>
          )}
        </div>
      )}
    </div>
  )
}

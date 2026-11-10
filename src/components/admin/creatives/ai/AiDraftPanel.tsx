import { useId, useState, type KeyboardEvent } from 'react'
import { Bot, ChevronDown, ChevronUp, CircleAlert, ChartColumn, LoaderCircle, PlugZap, Sparkles } from 'lucide-react'
import { BTN_PRIMARY, FIELD, HINT, LABEL } from '../../../settings/formClasses'
import type { PlanAiDraft } from '../../../../hooks/usePlanAiDraft'
import { FORMAT_LABEL, PLATFORM_LABEL } from '../../../../lib/creatives'
import { AI_BRIEF_MAX, AI_COST_HINT, AI_NOT_CONNECTED, aiBudgetWarning } from '../../../../lib/creativesAi'
import type { CreativeAiMeta, CreativeBudget, CreativeFormat, CreativePlatform } from '../../../../types/creatives'
import { AI_PANEL, NOTICE, SECTION_ICON, SECTION_SUB, TEXTAREA } from '../creativeClasses'
import AiDraftResult from './AiDraftResult'
import AiWorking from './AiWorking'

interface AiDraftPanelProps {
  ai: CreativeAiMeta
  state: PlanAiDraft
  platform: CreativePlatform
  format: CreativeFormat
  budget: CreativeBudget
  /** Start open — a new plan, or one with nothing written yet. Otherwise one tap opens it. */
  defaultOpen: boolean
}

/**
 * "Write it for me" at the top of the plan modal: type a short idea, and
 * Claude drafts the title, hook, script, caption, hashtags and video prompt
 * into the fields below. Platform and format come from the plan itself.
 * Without an Anthropic key on the server it is one muted line, never a dead form.
 */
export default function AiDraftPanel({ ai, state, platform, format, budget, defaultOpen }: AiDraftPanelProps) {
  const id = useId()
  const [expanded, setExpanded] = useState(defaultOpen)
  const { call } = state
  const busy = call.busy
  const budgetWarning = aiBudgetWarning(budget)

  if (!ai.configured) {
    return (
      <div className="flex items-start gap-3 rounded-row border border-border bg-surface2 px-3.5 py-3">
        <PlugZap size={16} aria-hidden="true" className="mt-0.5 flex-none text-muted" />
        <p className="min-w-0 text-[12.5px] leading-[1.55] text-muted">
          <span className="font-bold text-text">Write it for me</span> — {AI_NOT_CONNECTED}, so the AI writer is off
          here. Everything below still works by hand.
        </p>
      </div>
    )
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-expanded={false}
        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-row border border-accent-line bg-accent-soft px-3.5 py-2.5 text-left transition-[filter] duration-150 hover:brightness-[1.05]"
      >
        <Bot size={17} aria-hidden="true" className="flex-none text-accent" />
        <span className="min-w-0 flex-1 text-[12.5px] leading-[1.5] text-muted">
          <span className="font-bold text-text">Write it for me</span> — let Claude draft this plan from a short idea.
        </span>
        <ChevronDown size={16} aria-hidden="true" className="flex-none text-accent" />
      </button>
    )
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      state.write()
    }
  }

  return (
    <section id={id} className={AI_PANEL} aria-labelledby={`${id}-title`}>
      <div className="flex items-start gap-3">
        <span className={SECTION_ICON} aria-hidden="true">
          <Bot size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 id={`${id}-title`} className="font-display text-[15px] font-extrabold text-text">
            Write it for me
          </h4>
          <p className={SECTION_SUB}>
            Type a short idea. Claude writes the title, hook, script, caption, hashtags and video prompt below — a
            draft for you to check and edit.
          </p>
        </div>
        {!defaultOpen && !busy && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Fold the AI writer away"
            aria-expanded
            className="-mr-1 -mt-1 inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-btn text-muted transition-colors duration-150 hover:bg-surface hover:text-text"
          >
            <ChevronUp size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <label className={FIELD}>
        <span className={LABEL}>The idea</span>
        <textarea
          className={`${TEXTAREA} min-h-[72px] bg-surface`}
          rows={2}
          value={state.brief}
          maxLength={AI_BRIEF_MAX}
          onChange={(e) => state.setBrief(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="e.g. bot recap this week"
          disabled={busy}
          autoFocus={defaultOpen && state.brief === ''}
        />
        <span className={`${HINT} flex justify-between gap-3`}>
          <span className="max-sm:hidden">Ctrl + Enter writes it.</span>
          <span className="ml-auto">
            {state.brief.trim().length} / {AI_BRIEF_MAX}
          </span>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded-row border border-border bg-surface px-3.5 py-3">
        <input
          type="checkbox"
          className="mt-0.5 h-[18px] w-[18px] flex-none cursor-pointer accent-[var(--accent)]"
          checked={state.useFacts}
          onChange={(e) => state.setUseFacts(e.target.checked)}
          disabled={busy}
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-text">
            <ChartColumn size={14} aria-hidden="true" className="flex-none text-accent" />
            Use this week’s results
          </span>
          <span className="mt-0.5 block text-[12px] leading-[1.5] text-muted">
            Only the public figures Pixel Alpha already posts — percentages, trade counts and coins. Never dollar
            amounts, balances or names. Turn it off for a post that is not about results.
          </span>
        </span>
      </label>

      {budgetWarning && (
        <p className={NOTICE.warn} role="status">
          <CircleAlert size={15} aria-hidden="true" />
          {budgetWarning}
        </p>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0 text-[12px] leading-[1.5] text-muted">
          For <strong className="font-semibold text-text">{PLATFORM_LABEL[platform]}</strong> ·{' '}
          {FORMAT_LABEL[format].toLowerCase()} — change them under Platform and Format. {AI_COST_HINT}
        </p>
        <button
          type="button"
          className={`${BTN_PRIMARY} flex-none max-sm:w-full`}
          onClick={state.write}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? (
            <>
              <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
              Writing…
            </>
          ) : (
            <>
              <Sparkles size={15} aria-hidden="true" />
              {call.result ? 'Write it again' : 'Write it'}
            </>
          )}
        </button>
      </div>

      <AiWorking
        busy={busy}
        elapsed={call.elapsed}
        label="Claude is writing the whole post. The fields below unlock when it is done."
      />

      {state.attempted && state.problem && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {state.problem}
        </p>
      )}
      {call.error && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {call.error}
        </p>
      )}

      {call.result && !busy && (
        <div key={call.seq} className="animate-[fadeup_0.35s_ease-out]">
          <AiDraftResult
            result={call.result}
            canUndo={state.canUndo}
            onUndo={state.askUndo}
            notesAdded={state.notesAdded}
            onAddNotes={state.addNotes}
          />
        </div>
      )}
    </section>
  )
}

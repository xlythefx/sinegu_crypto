import { useCallback, useEffect, useState } from 'react'
import { useCreativeAiCall, type CreativeAiCall } from './useCreativeAiCall'
import { AI_BRIEF_MAX, AI_BRIEF_MIN, fieldsToReplace, type DraftField } from '../lib/creativesAi'
import { draftCreativePlan } from '../services/creatives'
import type {
  CreativeAiDraftInput,
  CreativeAiDraftResult,
  CreativeBudget,
  CreativeFormat,
  CreativePlatform,
} from '../types/creatives'

type Fields = Record<DraftField, string>

interface Options {
  /** The plan modal is open — opening it (again) starts over. */
  open: boolean
  /** null = a new plan. Links the call's cost record to the plan when set. */
  planId: number | null
  platform: CreativePlatform
  format: CreativeFormat
  /** The modal's current text in the six fields a draft fills. */
  fields: Fields
  /** A brief to start from ("Write it" on a suggested idea); none = follow the title. */
  seedBrief?: string | null
  /** A title put there from a suggested idea — not counted as someone's own writing. */
  seededTitle?: string | null
  applyFields: (fields: Fields) => void
  appendNote: (text: string) => void
  onBudget: (budget: CreativeBudget) => void
}

export interface PlanAiDraft {
  call: CreativeAiCall<CreativeAiDraftInput, CreativeAiDraftResult>
  /** The idea as shown — the plan's title until someone types their own. */
  brief: string
  setBrief: (brief: string) => void
  useFacts: boolean
  setUseFacts: (on: boolean) => void
  /** Why Write cannot go yet (shown once it was pressed), or null. */
  problem: string | null
  attempted: boolean
  /** Press Write: straight to Claude, or first a ConfirmModal when text would be replaced. */
  write: () => void
  /** The fields with text a draft would replace — the confirmation is open while set. */
  replacing: DraftField[] | null
  confirmReplace: () => void
  cancelReplace: () => void
  /** A draft is in the fields: saving sends `ai_drafted: true`. */
  drafted: boolean
  /** What was there before the latest draft can still be put back. */
  canUndo: boolean
  undoAsked: boolean
  askUndo: () => void
  confirmUndo: () => void
  cancelUndo: () => void
  /** Claude's notes were copied into the plan's Notes. */
  notesAdded: boolean
  addNotes: () => void
}

const FALLBACK = 'Could not write the draft.'

/**
 * The plan modal's "Write it for me": the brief, the facts switch, the call
 * to Claude and what it changes. Text someone wrote is never replaced without
 * a ConfirmModal, and the latest draft can be undone (also confirmed), so the
 * AI can only ever add work, never quietly take it away.
 */
export function usePlanAiDraft({
  open,
  planId,
  platform,
  format,
  fields,
  seedBrief,
  seededTitle,
  applyFields,
  appendNote,
  onBudget,
}: Options): PlanAiDraft {
  const call = useCreativeAiCall(draftCreativePlan, { onBudget, fallback: FALLBACK })
  const [briefOverride, setBriefOverride] = useState<string | null>(null)
  const [useFacts, setUseFacts] = useState(true)
  const [attempted, setAttempted] = useState(false)
  const [replacing, setReplacing] = useState<DraftField[] | null>(null)
  const [drafted, setDrafted] = useState(false)
  const [undo, setUndo] = useState<{ fields: Fields; drafted: boolean } | null>(null)
  const [undoAsked, setUndoAsked] = useState(false)
  const [notesAdded, setNotesAdded] = useState(false)
  const { reset } = call

  // Every opening starts clean, like the plan form itself.
  useEffect(() => {
    if (!open) return
    reset()
    setBriefOverride(seedBrief ?? null)
    setUseFacts(true)
    setAttempted(false)
    setReplacing(null)
    setDrafted(false)
    setUndo(null)
    setUndoAsked(false)
    setNotesAdded(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, planId, reset])

  const brief = briefOverride ?? fields.title
  const length = brief.trim().length
  const problem =
    length < AI_BRIEF_MIN
      ? 'Type the idea first — a few words is enough, like “bot recap this week”.'
      : length > AI_BRIEF_MAX
        ? `Keep the idea under ${AI_BRIEF_MAX} characters.`
        : null

  const draft = async () => {
    const text = brief.trim()
    // Freeze the brief: the title is about to change under it.
    setBriefOverride(brief)
    const before = { ...fields }
    const wasDrafted = drafted
    const answer = await call.run({
      brief: text,
      platform,
      format,
      use_facts: useFacts,
      ...(planId !== null ? { plan_id: planId } : {}),
    })
    if (!answer) return
    const d = answer.draft
    applyFields({
      // A draft with no title keeps the one there — a plan cannot be saved without one.
      title: d.title.trim().slice(0, 160) || before.title,
      hook: d.hook,
      script: d.script,
      caption: d.caption,
      hashtags: d.hashtags,
      video_prompt: d.video_prompt,
    })
    setUndo({ fields: before, drafted: wasDrafted })
    setDrafted(true)
    setNotesAdded(false)
    setAttempted(false)
  }

  const write = () => {
    setAttempted(true)
    if (problem || call.busy) return
    const replace = fieldsToReplace(fields, brief, seededTitle)
    if (replace.length > 0) setReplacing(replace)
    else void draft()
  }

  const confirmReplace = () => {
    setReplacing(null)
    void draft()
  }

  const confirmUndo = () => {
    setUndoAsked(false)
    if (!undo) return
    applyFields(undo.fields)
    setDrafted(undo.drafted)
    setUndo(null)
  }

  const addNotes = () => {
    const notes = call.result?.draft.notes.trim()
    if (!notes || notesAdded) return
    appendNote(notes)
    setNotesAdded(true)
  }

  const setBrief = useCallback((next: string) => setBriefOverride(next), [])

  return {
    call,
    brief,
    setBrief,
    useFacts,
    setUseFacts,
    problem,
    attempted,
    write,
    replacing,
    confirmReplace,
    cancelReplace: () => setReplacing(null),
    drafted,
    canUndo: undo !== null && !call.busy,
    undoAsked,
    askUndo: () => setUndoAsked(true),
    confirmUndo,
    cancelUndo: () => setUndoAsked(false),
    notesAdded,
    addNotes,
  }
}

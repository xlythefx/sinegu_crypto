import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Clapperboard, Ellipsis, LoaderCircle, Pencil, Sparkles } from 'lucide-react'
import { PLAN_STAGES } from '../../../../lib/creatives'
import { makeLabel } from '../../../../lib/creativesAi'
import type { CreativePlan, CreativePlanStatus } from '../../../../types/creatives'
import { STAGE_ICON } from '../creativeIcons'

interface PlanQuickMenuProps {
  plan: CreativePlan
  /** A stage move is being saved for this plan. */
  moving: boolean
  onEdit: () => void
  onGenerate: () => void
  onMove: (status: CreativePlanStatus) => void
}

const MENU_WIDTH = 236
const ITEM =
  'flex w-full min-h-10 cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-semibold transition-colors duration-150'

/**
 * A card's quick actions: open it, generate for it ("Make the video" once it
 * has a video prompt — the Studio opens with it filled in), or move it to
 * another stage in one tap. Portaled and placed from the trigger's rect (the board
 * scrolls sideways inside an AOS card, which would clip or trap it).
 */
export default function PlanQuickMenu({ plan, moving, onEdit, onGenerate, onMove }: PlanQuickMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const box = triggerRef.current.getBoundingClientRect()
    const height = 120 + PLAN_STAGES.length * 40
    const below = box.bottom + 6
    const top = below + height > window.innerHeight && box.top > height ? box.top - height - 6 : below
    const left = Math.min(box.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 12)
    setRect({ top: Math.max(12, top), left: Math.max(12, left) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    // Any scroll moves the trigger out from under a fixed menu, so close.
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const pick = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${plan.title}`}
        className={`-mr-1 -mt-1 inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-btn border transition-colors duration-150 ${
          open
            ? 'border-accent-line bg-accent-soft text-accent'
            : 'border-transparent text-muted hover:border-border hover:bg-surface hover:text-text'
        }`}
      >
        {moving ? <LoaderCircle size={15} className="animate-spin" /> : <Ellipsis size={16} />}
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[1000] max-h-[calc(100vh-24px)] overflow-y-auto rounded-card border border-border bg-surface p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.4)] animate-[fadeup_0.16s_ease-out]"
            style={{ top: rect.top, left: rect.left, width: MENU_WIDTH }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="truncate px-2.5 pb-2 pt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              {plan.title}
            </p>
            <button type="button" role="menuitem" className={`${ITEM} text-text hover:bg-surface2`} onClick={() => pick(onEdit)}>
              <Pencil size={14} className="flex-none text-muted" aria-hidden="true" />
              Open and edit
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${ITEM} text-text hover:bg-surface2`}
              onClick={() => pick(onGenerate)}
            >
              {plan.video_prompt ? (
                <Clapperboard size={14} className="flex-none text-accent" aria-hidden="true" />
              ) : (
                <Sparkles size={14} className="flex-none text-accent" aria-hidden="true" />
              )}
              {plan.video_prompt ? makeLabel(plan.format) : 'Generate for this plan'}
            </button>
            <p className="mt-1.5 border-t border-hair px-2.5 pb-1.5 pt-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              Move to
            </p>
            {PLAN_STAGES.map((stage) => {
              const Icon = STAGE_ICON[stage.key]
              const current = stage.key === plan.status
              return (
                <button
                  key={stage.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  disabled={current || moving}
                  className={`${ITEM} ${
                    current ? 'cursor-default text-accent' : 'text-text hover:bg-surface2 disabled:opacity-50'
                  }`}
                  onClick={() => pick(() => onMove(stage.key))}
                >
                  <Icon size={14} className="flex-none text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{stage.label}</span>
                  {current && <Check size={14} className="flex-none" aria-hidden="true" />}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}

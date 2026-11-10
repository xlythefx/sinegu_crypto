import { useRef, type KeyboardEvent } from 'react'
import { Clapperboard, Coins, MessageCircle, ShieldCheck, SquarePen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MODE_HINT, PANELS, type CreativesPanelKey } from '../../../../lib/creativesAgent'
import type { CreativeAgentMode, CreativeBudget } from '../../../../types/creatives'
import BudgetPill from '../BudgetPill'
import { PANEL_ICON } from './agentIcons'

interface AgentTopBarProps {
  mode: CreativeAgentMode
  onMode: (mode: CreativeAgentMode) => void
  /** A turn is running — the mode holds until it is done. */
  modeLocked: boolean
  budget: CreativeBudget
  panel: CreativesPanelKey | null
  onTogglePanel: (panel: CreativesPanelKey) => void
  onNewChat: () => void
  newChatDisabled: boolean
  /** Higgsfield is connected — Generate says so when it is not. */
  higgsfield: boolean
}

const MODES: Array<{ value: CreativeAgentMode; label: string; Icon: LucideIcon }> = [
  { value: 'ask', label: 'Ask', Icon: MessageCircle },
  { value: 'generate', label: 'Generate', Icon: Clapperboard },
]

/** Ask | Generate as one radio group; Generate is the gold one, because it is the one that can spend. */
function ModeSwitch({ mode, onMode, locked }: { mode: CreativeAgentMode; onMode: (m: CreativeAgentMode) => void; locked: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? MODES.length - 1 : (i + 1) % MODES.length
    onMode(MODES[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div
      role="radiogroup"
      aria-label="Mode"
      className="inline-flex flex-none gap-1 rounded-[13px] border border-border bg-surface p-1"
      title={locked ? 'The mode can change once the agent has answered' : undefined}
    >
      {MODES.map(({ value, label, Icon }, i) => {
        const on = value === mode
        const tone = on
          ? value === 'generate'
            ? 'border-transparent bg-accent text-on-accent shadow-[0_6px_16px_var(--glow)]'
            : 'border-border bg-surface2 text-text shadow-[0_1px_2px_rgba(0,0,0,0.16)]'
          : 'border-transparent bg-transparent text-muted hover:text-text'
        return (
          <button
            key={value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={locked && !on}
            onClick={() => onMode(value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[9px] border px-2.5 text-[13px] font-bold sm:px-3.5 transition-[color,background-color,border-color,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
          >
            <Icon size={14} aria-hidden="true" className="max-[420px]:hidden" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

const TOGGLE =
  'inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-btn border transition-[border-color,background,color] duration-150 sm:h-9 sm:w-9'

/**
 * The workspace's slim bar, sticky above the chat: the mode (with one line
 * saying what it means), the budget, a toggle per panel and New chat. On a
 * phone the panel toggles take a row of their own, spread across it.
 */
export default function AgentTopBar({
  mode,
  onMode,
  modeLocked,
  budget,
  panel,
  onTogglePanel,
  onNewChat,
  newChatDisabled,
  higgsfield,
}: AgentTopBarProps) {
  const generate = mode === 'generate'
  const hint =
    generate && !higgsfield
      ? 'Higgsfield isn’t connected on this server, so nothing can be made here — the agent can still plan and write'
      : MODE_HINT[mode]
  const HintIcon = generate ? Coins : ShieldCheck

  return (
    <div
      className="sticky top-0 z-30 mb-2 border-b border-hair bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] py-3 backdrop-blur-md"
      data-aos="fade-up"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2.5 sm:gap-x-3">
        <ModeSwitch mode={mode} onMode={onMode} locked={modeLocked} />

        <div
          role="toolbar"
          aria-label="Panels"
          className="order-last flex w-full items-center justify-between gap-1 sm:order-none sm:ml-auto sm:w-auto sm:justify-start"
        >
          {PANELS.map((p) => {
            const Icon = PANEL_ICON[p.key]
            const on = panel === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onTogglePanel(p.key)}
                aria-pressed={on}
                aria-label={p.label}
                title={`${p.label} — ${p.hint}`}
                className={`${TOGGLE} ${
                  on
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-transparent bg-transparent text-muted hover:border-border hover:bg-surface hover:text-text'
                }`}
              >
                <Icon size={17} aria-hidden="true" />
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <span className="hidden h-6 w-px bg-hair sm:block" aria-hidden="true" />
          <BudgetPill budget={budget} active={panel === 'budget'} onOpen={() => onTogglePanel('budget')} />
          <button
            type="button"
            onClick={onNewChat}
            disabled={newChatDisabled}
            title="Start a new chat"
            className="inline-flex min-h-9 flex-none cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-surface px-3 text-[12.5px] font-bold text-text transition-[border-color,background] duration-150 hover:border-accent-line hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SquarePen size={14} aria-hidden="true" />
            <span className="max-[420px]:sr-only">New chat</span>
          </button>
        </div>
      </div>

      <p
        key={`${mode}-${higgsfield}`}
        className={`mt-2 inline-flex items-start gap-1.5 text-[12px] font-semibold leading-[1.45] animate-[fadeup_0.3s_ease-out] ${
          generate ? 'text-accent' : 'text-muted'
        }`}
      >
        <HintIcon size={13} aria-hidden="true" className="mt-[2px] flex-none" />
        {hint}
      </p>
    </div>
  )
}

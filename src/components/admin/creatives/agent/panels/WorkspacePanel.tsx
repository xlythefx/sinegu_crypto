import { useCallback } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { panelMeta, type CreativesDocPanel, type CreativesPanelKey } from '../../../../../lib/creativesAgent'
import type { CreativeAiMeta, CreativeBudget, CreativesMeta } from '../../../../../types/creatives'
import NotConfiguredNotice from '../../NotConfiguredNotice'
import BriefPanel from '../../brief/BriefPanel'
import ContextPanel from '../../context/ContextPanel'
import PlaybookPanel from '../../playbook/PlaybookPanel'
import StylesPanel from '../../styles/StylesPanel'
import VideosPanel from '../../videos/VideosPanel'
import BudgetTab from '../../budget/BudgetTab'
import CharacterTab from '../../character/CharacterTab'
import MemoryPanel from '../../memory/MemoryPanel'
import PlannerTab from '../../planner/PlannerTab'
import StudioTab from '../../studio/StudioTab'
import { PANEL_ICON } from '../agentIcons'
import PanelShell, { type PanelPlacement } from './PanelShell'

interface WorkspacePanelProps {
  panel: CreativesPanelKey
  placement: PanelPlacement
  /** Plans only: the wide overlay with the board. */
  wide: boolean
  onWide: (wide: boolean) => void
  onClose: () => void
  /** Switch to another panel (guarded by the workspace for unsaved brief edits). */
  onOpen: (panel: CreativesPanelKey, extra?: { plan?: number; make?: boolean }) => void
  meta: CreativesMeta
  budget: CreativeBudget
  onBudget: (budget: CreativeBudget) => void
  ai: CreativeAiMeta
  onAi: (ai: CreativeAiMeta) => void
  /** `?plan=` — Plans: open this plan; Gallery: "Make it yourself" starts with it. */
  planId: number | null
  onPlanHandled: () => void
  makeOpen: boolean
  signals: { plans: number; memory: number; gallery: number; videos: number }
  /** Unsaved edits in a Markdown document panel (brief, playbook). */
  onDocDirty: (doc: CreativesDocPanel, dirty: boolean) => void
  /** The open chat, for the Context panel. */
  sessionId: string | null
}

const EXPAND_BTN =
  'inline-flex h-10 flex-none cursor-pointer items-center gap-1.5 rounded-btn px-2.5 text-[12px] font-bold text-muted transition-colors duration-150 hover:bg-surface hover:text-text max-lg:hidden'

/**
 * One panel of the chat workspace, in its frame. The panels are the page's
 * former tabs, reused as they are — Plans (the Planner, a list here and the
 * whole board in "Expand"), Gallery (the gallery plus "Make it yourself"),
 * Pixel, Budget — plus Brief, Memory and (Creatives v2) Videos, Styles,
 * Playbook and Context. Only the cap and the weekly-recap
 * switch stay full-admin (`can_edit_budget`), as before.
 */
export default function WorkspacePanel({
  panel,
  placement,
  wide,
  onWide,
  onClose,
  onOpen,
  meta,
  budget,
  onBudget,
  ai,
  onAi,
  planId,
  onPlanHandled,
  makeOpen,
  signals,
  onDocDirty,
  sessionId,
}: WorkspacePanelProps) {
  const { label } = panelMeta(panel)
  // Stable, or the document panel's dirty effect would re-run on every render.
  const onPlaybookDirty = useCallback((d: boolean) => onDocDirty('playbook', d), [onDocDirty])
  const onBriefDirty = useCallback((d: boolean) => onDocDirty('brief', d), [onDocDirty])

  const actions =
    panel === 'plans' ? (
      <button
        type="button"
        className={EXPAND_BTN}
        onClick={() => onWide(!wide)}
        title={wide ? 'Back to the side panel' : 'See the whole board'}
      >
        {wide ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
        {wide ? 'Collapse' : 'Expand'}
      </button>
    ) : undefined

  return (
    <PanelShell
      placement={wide ? 'wide' : placement}
      title={label}
      icon={PANEL_ICON[panel]}
      onClose={onClose}
      actions={actions}
      contentKey={`${panel}-${wide ? 'wide' : 'side'}`}
    >
      {panel === 'plans' && (
        <PlannerTab
          layout={wide ? 'auto' : 'list'}
          onGenerate={(id) => onOpen('gallery', { plan: id })}
          ai={ai}
          onAi={onAi}
          canEditAi={meta.can_edit_budget}
          budget={budget}
          onBudget={onBudget}
          openPlanId={planId}
          onOpenedPlan={onPlanHandled}
          reloadSignal={signals.plans}
        />
      )}
      {panel === 'gallery' && (
        <>
          {!meta.configured && <NotConfiguredNotice />}
          <StudioTab
            variant="panel"
            makeOpen={makeOpen}
            meta={meta}
            budget={budget}
            onBudget={onBudget}
            onOpenCharacter={() => onOpen('pixel')}
            reloadSignal={signals.gallery}
          />
        </>
      )}
      {panel === 'pixel' && (
        <CharacterTab maxReferences={meta.max_references} onOpenStudio={() => onOpen('gallery', { make: true })} />
      )}
      {panel === 'videos' && <VideosPanel reloadSignal={signals.videos} />}
      {panel === 'styles' && <StylesPanel />}
      {panel === 'playbook' && <PlaybookPanel onDirtyChange={onPlaybookDirty} />}
      {panel === 'context' && <ContextPanel sessionId={sessionId} />}
      {panel === 'brief' && <BriefPanel onDirtyChange={onBriefDirty} />}
      {panel === 'memory' && <MemoryPanel reloadSignal={signals.memory} />}
      {panel === 'budget' && <BudgetTab budget={budget} onBudget={onBudget} canEdit={meta.can_edit_budget} />}
    </PanelShell>
  )
}

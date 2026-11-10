import { Navigate, useSearchParams } from 'react-router-dom'
import { SquareKanban, UserRound, Wallet, WandSparkles } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import BudgetPill from '../../components/admin/creatives/BudgetPill'
import NotConfiguredNotice from '../../components/admin/creatives/NotConfiguredNotice'
import BudgetTab from '../../components/admin/creatives/budget/BudgetTab'
import CharacterTab from '../../components/admin/creatives/character/CharacterTab'
import PlannerTab from '../../components/admin/creatives/planner/PlannerTab'
import StudioTab from '../../components/admin/creatives/studio/StudioTab'
import DataState from '../../components/dashboard/DataState'
import Tabs, { type TabItem } from '../../components/ui/Tabs'
import { useCreativesMeta } from '../../hooks/useCreativesMeta'
import { ApiError } from '../../services/api'

type CreativesTab = 'planner' | 'studio' | 'character' | 'budget'

const TABS: TabItem<CreativesTab>[] = [
  { key: 'planner', label: 'Planner', Icon: SquareKanban },
  { key: 'studio', label: 'Studio', Icon: WandSparkles },
  { key: 'character', label: 'Character', Icon: UserRound },
  { key: 'budget', label: 'Budget', Icon: Wallet },
]

const TITLE = 'Creatives'
const SUBTITLE =
  'Plan X and TikTok posts, let Claude draft them, and make images and videos of the Pixel Alpha character with Higgsfield.'

/**
 * Admin → Creatives: the marketing team's page — the ONE admin area a
 * collaborator may write in (owner, 2026-11-10). Four tabs in `?tab=`:
 * Planner (default, with the AI writer), Studio (`&plan=` preselects a plan
 * and fills its video prompt), Character, Budget. Only the monthly cap and the
 * weekly-recap switch are full-admin (`can_edit_budget`).
 */
export default function AdminCreatives() {
  const { meta, budget, setBudget, ai, setAi, loading, error, reload } = useCreativesMeta()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: CreativesTab = TABS.some((t) => t.key === raw) ? (raw as CreativesTab) : 'planner'

  const select = (next: CreativesTab) => setParams(next === 'planner' ? {} : { tab: next }, { replace: true })
  const generateFor = (planId: number) => setParams({ tab: 'studio', plan: String(planId) })

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!meta || !budget || !ai) {
    return (
      <AdminLayout title={TITLE} subtitle={SUBTITLE}>
        <DataState loading={loading} error={error} onRetry={reload} label="Creatives" />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      {!meta.configured && <NotConfiguredNotice />}

      <div className="mb-stack flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={TABS} active={tab} onChange={select} label="Creatives sections" />
        <BudgetPill budget={budget} onOpen={() => select('budget')} />
      </div>

      {/* keyed re-mount replays the reveal on every tab switch */}
      <div key={tab} className="animate-[fadeup_0.35s_ease-out]">
        {tab === 'planner' && (
          <PlannerTab
            onGenerate={generateFor}
            ai={ai}
            onAi={setAi}
            canEditAi={meta.can_edit_budget}
            budget={budget}
            onBudget={setBudget}
          />
        )}
        {tab === 'studio' && (
          <StudioTab
            meta={meta}
            budget={budget}
            onBudget={setBudget}
            onOpenCharacter={() => select('character')}
          />
        )}
        {tab === 'character' && (
          <CharacterTab maxReferences={meta.max_references} onOpenStudio={() => select('studio')} />
        )}
        {tab === 'budget' && <BudgetTab budget={budget} onBudget={setBudget} canEdit={meta.can_edit_budget} />}
      </div>
    </AdminLayout>
  )
}

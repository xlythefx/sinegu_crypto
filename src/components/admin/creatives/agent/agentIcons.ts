import {
  Bot,
  Boxes,
  Brain,
  ChartLine,
  Clapperboard,
  FileText,
  Images,
  PenLine,
  SquareKanban,
  Wallet,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CreativesPanelKey } from '../../../../lib/creativesAgent'

/** One icon per panel — the toggles and the panel headers alike. */
export const PANEL_ICON: Record<CreativesPanelKey, LucideIcon> = {
  plans: SquareKanban,
  gallery: Images,
  pixel: Bot,
  brief: FileText,
  memory: Brain,
  budget: Wallet,
}

/** The agent's tools, for the activity lines (an unknown tool gets the wrench). */
const TOOL_ICON: Record<string, LucideIcon> = {
  list_plans: SquareKanban,
  get_plan: SquareKanban,
  create_plan: PenLine,
  update_plan: PenLine,
  list_generations: Images,
  get_character: Bot,
  get_week_results: ChartLine,
  get_budget: Wallet,
  list_models: Boxes,
  remember: Brain,
  forget: Brain,
  update_memory: Brain,
  propose_job: Clapperboard,
}

export function toolIcon(tool: string): LucideIcon {
  return TOOL_ICON[tool] ?? Wrench
}

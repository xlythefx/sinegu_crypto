import {
  BookOpen,
  Bot,
  Boxes,
  Braces,
  Brain,
  ChartLine,
  Clapperboard,
  Database,
  FileText,
  Film,
  Images,
  ListChecks,
  Palette,
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
  videos: Film,
  pixel: Bot,
  styles: Palette,
  playbook: BookOpen,
  brief: FileText,
  memory: Brain,
  context: Braces,
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
  query_data: Database,
  ask_choices: ListChecks,
  get_style: Palette,
  create_video: Film,
  add_scenes: Film,
  get_video: Film,
  list_videos: Film,
}

export function toolIcon(tool: string): LucideIcon {
  return TOOL_ICON[tool] ?? Wrench
}

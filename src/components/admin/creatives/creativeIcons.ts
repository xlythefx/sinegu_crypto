import {
  Ban,
  CircleCheck,
  Clock,
  Eye,
  Film,
  GalleryHorizontal,
  Image as ImageIcon,
  ImageOff,
  Lightbulb,
  LoaderCircle,
  PenLine,
  Send,
  ShieldAlert,
  TriangleAlert,
  WandSparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CreativeFormat, CreativeGenerationStatus, CreativePlanStatus } from '../../../types/creatives'

/** One icon per plan stage, board and menus alike. */
export const STAGE_ICON: Record<CreativePlanStatus, LucideIcon> = {
  idea: Lightbulb,
  script: PenLine,
  generating: WandSparkles,
  review: Eye,
  approved: CircleCheck,
  posted: Send,
}

export const FORMAT_ICON: Record<CreativeFormat, LucideIcon> = {
  video: Film,
  image: ImageIcon,
  carousel: GalleryHorizontal,
}

export const GENERATION_ICON: Record<CreativeGenerationStatus, LucideIcon> = {
  submitting: LoaderCircle,
  queued: Clock,
  in_progress: LoaderCircle,
  completed: CircleCheck,
  failed: TriangleAlert,
  nsfw: ShieldAlert,
  canceled: Ban,
  expired: ImageOff,
}

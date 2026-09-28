import type { EmailAudience } from '../../../types/emailTemplates'

export const AUDIENCE_LABEL: Record<EmailAudience, string> = {
  customer: 'To customers',
  team: 'To the team',
}

/** Phone ≈ a small handset's mail app; desktop = the template's own 520px card plus its margin. */
export const FRAME_WIDTHS = { phone: 375, desktop: 640 } as const
export type FrameWidth = keyof typeof FRAME_WIDTHS

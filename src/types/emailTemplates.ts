/** Who an email is written for. */
export type EmailAudience = 'customer' | 'team'

/** One email the product sends, rendered with sample data (`GET /admin/sandbox/emails`). */
export interface EmailTemplate {
  slug: string
  audience: EmailAudience
  title: string
  /** When it is sent, in plain words. */
  trigger: string
  /** Who receives it — a description for customer mail, the address list for team mail. */
  to: string
  /** True when production sends it today; false = designed, waiting for approval. */
  live: boolean
  note: string
  subject: string
  /** The full email document, exactly as a mail client receives it. */
  html: string
}

export interface EmailTemplateCatalogue {
  emails: EmailTemplate[]
  /** The address every email is sent from. */
  from: string
  team_recipients: string[]
  /** False when the server's mailer is `log`: a "sent" copy is only written to its log. */
  delivers: boolean
}

export interface EmailPreviewSendResult {
  sent: number
  delivers: boolean
}

import { apiFetch } from './api'
import type {
  EmailPreviewSendResult,
  EmailTemplateCatalogue,
} from '../types/emailTemplates'

/** Every email the product sends, rendered from the real templates with sample data. */
export async function getEmailTemplates(): Promise<EmailTemplateCatalogue> {
  const res = await apiFetch<{ success: boolean } & EmailTemplateCatalogue>(
    '/admin/sandbox/emails',
    { auth: true },
  )
  return {
    emails: res.emails,
    from: res.from,
    team_recipients: res.team_recipients,
    delivers: res.delivers,
  }
}

/**
 * Mail a "[Preview]" copy to a reviewer — one template by slug, or every
 * template when `slug` is omitted. Sample data only; no customer is mailed.
 */
export async function sendEmailPreview(input: {
  to: string
  slug?: string
}): Promise<EmailPreviewSendResult> {
  const res = await apiFetch<{ success: boolean } & EmailPreviewSendResult>(
    '/admin/sandbox/emails/send',
    { method: 'POST', body: input, auth: true },
  )
  return { sent: res.sent, delivers: res.delivers }
}

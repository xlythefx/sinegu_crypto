import type { VisitFilterReason, VisitFunnelKey } from '../types/visitors'

/** Plain-English names for Admin → Visitors. Pure. */

export const VISIT_FUNNEL_LABELS: Record<VisitFunnelKey, string> = {
  visited: 'Visited the website',
  opened_signup: 'Opened sign in / register',
  signed_up: 'Created an account',
  verified: 'Confirmed their email',
  approved: 'Approved',
  connected: 'Connected a live exchange',
}

/** Why a ping was not counted — the spam filter's reasons, in the order the rules run. */
export const VISIT_FILTER_LABELS: Record<VisitFilterReason | 'suspicious', { label: string; hint: string }> = {
  bot: {
    label: 'Bots & scripts',
    hint: 'Search engines, scanners, link previews and automated browsers. Never saved.',
  },
  foreign: {
    label: 'Not from our site',
    hint: 'The ping did not come from a pixel-alpha.com page. Never saved.',
  },
  unknown_page: {
    label: 'Unknown pages',
    hint: 'A page that is not on the public website. Never saved.',
  },
  team: {
    label: 'Our team',
    hint: 'Someone signed in with a staff account. Our own clicks are not traffic.',
  },
  flood: {
    label: 'Floods',
    hint: 'More than 30 pings a minute, or 300 a day, from one IP. The IP is marked suspicious for the day.',
  },
  repeat: {
    label: 'Refreshes',
    hint: 'The same visitor on the same page within 30 minutes counts once.',
  },
  suspicious: {
    label: 'Suspicious, kept aside',
    hint: 'Saved so you can look at them (Visitor log → Suspicious), but left out of every number on this page.',
  },
}

export const SUSPICIOUS_REASON_LABELS: Record<'flood' | 'burst', string> = {
  flood: 'Too many pings',
  burst: 'Many pages in seconds',
}

/** "1 visitor" / "3 visitors". */
export function visitorsLabel(n: number): string {
  return `${n.toLocaleString()} ${n === 1 ? 'visitor' : 'visitors'}`
}

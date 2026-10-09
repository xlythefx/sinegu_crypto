import type {
  MasterOutcome,
  ReasonSeverity,
  SignalIssue,
  TradeLogDetail,
  TradeLogRow,
} from '../types/tradeLogs'

/** "1 problem" / "3 problems" — the noun is passed singular and plural. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export type BadgeTone = 'good' | 'bad' | 'neutral'

export interface MasterBadge {
  label: string
  tone: BadgeTone
  /** Hover text: what the badge means, in a sentence. */
  title: string
}

/**
 * The master account's badge on a signal row. Only a master that was IN the
 * fan-out and did not trade for a problem reason is red: a normal skip
 * ("nothing open to close") is how the strategy works, and `absent` is on
 * purpose (a close narrowed to chosen customers, or a venue the master has no
 * account on). null = the engine sent no master flag, so nothing is claimed.
 */
export function masterBadge(
  master: MasterOutcome | null,
  masterDetail: TradeLogDetail | undefined,
): MasterBadge | null {
  const why = masterDetail?.reasonLabel ?? masterDetail?.reason ?? masterDetail?.error
  switch (master) {
    case null:
      return null
    case 'filled':
      return { label: 'Master', tone: 'good', title: 'The master account traded this signal.' }
    case 'failed':
      return {
        label: 'Master failed',
        tone: 'bad',
        title: `The master account's order did not go through${why ? ` — ${why}` : ''}.`,
      }
    case 'skipped':
      return {
        label: 'Master skipped',
        tone: masterDetail?.severity === 'normal' ? 'neutral' : 'bad',
        title: `The master account skipped this signal${why ? ` — ${why}` : ''}.`,
      }
    case 'absent':
      return {
        label: 'No master',
        tone: 'neutral',
        title:
          'The master account was not part of this signal — for example a close aimed at chosen customers, or a venue the master has no account on.',
      }
  }
}

/** The master's own row in a signal's fan-out, if the engine flagged one. */
export function masterDetailOf(log: TradeLogRow): TradeLogDetail | undefined {
  return log.details.find((d) => d.isMaster === true)
}

/** What a skip/failure is, on the severity scale (a fill has none). */
export function severityOf(detail: TradeLogDetail): ReasonSeverity | null {
  if (detail.severity) return detail.severity
  // An API older than the split: a failure is always a problem.
  return detail.status === 'failed' ? 'problem' : null
}

/**
 * Account rows in the order a reader scans them: the master first, then
 * problems, then normal skips, then fills — engine order kept within each.
 */
export function sortDetails(details: TradeLogDetail[]): TradeLogDetail[] {
  const rank = (d: TradeLogDetail) => {
    if (d.isMaster) return 0
    const s = severityOf(d)
    if (s === 'problem') return 1
    if (s === 'normal' || d.status === 'skipped') return 2
    return 3
  }
  return details
    .map((d, i) => ({ d, i, r: rank(d) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ d }) => d)
}

/**
 * Who an issue is about, as one line: "Master account", "Ana — ana-binance",
 * or the coin for a rejected signal (which reached no account).
 */
export function issueWho(issue: SignalIssue): string {
  if (issue.isMaster) return 'Master account'
  if (issue.userName && issue.account && issue.userName !== issue.account) {
    return `${issue.userName} — ${issue.account}`
  }
  return issue.userName ?? issue.account ?? (issue.tickers.join(', ') || 'Unknown account')
}

/** The shorter form for a compact line: a person's name over their account's. */
export function issueWhoShort(issue: SignalIssue): string {
  if (issue.isMaster) return 'Master account'
  return issue.userName ?? issue.account ?? (issue.tickers.join(', ') || 'Unknown account')
}

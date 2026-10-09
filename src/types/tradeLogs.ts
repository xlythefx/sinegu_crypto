import type { ExchangeKind } from './exchanges'

export type TradeAction = 'BUY' | 'SELL' | 'EXIT_LONG' | 'EXIT_SHORT'
export type FanoutStatus = 'filled' | 'skipped' | 'failed'

/**
 * The engine's balance-proportional sizing decision for one account, recorded
 * at signal time. Present on entries only — exits close whatever is open, and
 * a rejected signal never reaches an account.
 *
 * The rule: below `referenceBalance` every account gets exactly one `baseSize`.
 * Above it, coarse-step tickers (BTCUSDT) step in whole `baseSize` multiples
 * per reference block; everything else steps in tenths, floored.
 */
export interface SizingDecision {
  balance: number | null
  /**
   * Deposit gate. An account blocked by it carries only these two plus
   * `balance` — every other field stays null, so never assume a full block.
   */
  totalDeposit: number | null
  minDeposit: number | null
  baseSize: number | null
  referenceBalance: number | null
  coarseStep: boolean
  quantity: number | null
  sizeMultiple: number | null
  stacksNow: number | null
  maxIncrements: number | null
  /**
   * Streak sizing — null unless the asset had a ladder at signal time.
   * `streakRun` is signed (-3 = three losses in a row, +2 = two wins);
   * `streakKind`/`streakStep` name the step applied (step 0 = base size);
   * `streakSize` is the size the multiple was applied to; `streakKnown: false`
   * means the history read failed and base size was used.
   */
  streakRun: number | null
  streakKnown: boolean | null
  streakKind: 'loss' | 'win' | null
  streakStep: number | null
  streakSize: number | null
}

/**
 * The API's verdict on a skip or failure (SignalHealth): `normal` is how the
 * strategy works (nothing open to close, stack already full) and needs nobody;
 * `problem` means someone has to act (a refused key, a refused order).
 */
export type ReasonSeverity = 'normal' | 'problem'

/**
 * How the master account did on a signal. `absent` = the master was not in
 * the fan-out at all — on purpose for a close narrowed to chosen customers,
 * or on a venue the master has no account on — so it is not a fault.
 */
export type MasterOutcome = 'filled' | 'skipped' | 'failed' | 'absent'

/** Account-level list filter: signals with at least one account in it. */
export type TradeLogOutcome = 'filled' | 'skipped' | 'failed' | 'problem'

/** One account's outcome inside a signal's fan-out. */
export interface TradeLogDetail {
  account: string | null
  uniId: string | null
  userName: string | null
  status: FanoutStatus | null
  /** The raw engine text — always shown beside the label, never replaced by it. */
  reason: string | null
  error: string | null
  retryable: boolean | null
  quantity: number | null
  fillPrice: number | null
  closedQuantity: number | null
  sizing: SizingDecision | null
  /** Stable reason key (`key_blocked`, `nothing_to_close`, …); null for a fill. */
  reasonKey: string | null
  /** Plain label for `reasonKey`, from the server. */
  reasonLabel: string | null
  severity: ReasonSeverity | null
  /** null = the engine sent no master flag on this row. */
  isMaster: boolean | null
  /** false only when account filters are on and this row is not one they found. */
  match: boolean
}

/** One append-only row per signal the engine processed. */
export interface TradeLogRow {
  id: number
  exchange: ExchangeKind
  action: TradeAction
  ticker: string
  success: boolean
  price: number | null
  strategy: string | null
  leverage: number | null
  category: string | null
  targetCount: number
  filled: number
  failed: number
  skipped: number
  details: TradeLogDetail[]
  ts: string | null
  /** null = the engine sent no master flag on this signal. */
  master: MasterOutcome | null
  /** Account outcomes the API calls a problem. */
  problems: number
  /** Account outcomes that are skips by design. */
  normalSkips: number
}

export interface TradeLogSummary {
  signals: number
  cleanSignals: number
  filled: number
  failed: number
  skipped: number
  /** Account outcomes in the filtered window that need someone. */
  problemAccounts: number
  /** Account outcomes in the filtered window that are skips by design. */
  normalSkips: number
}

/** One reason the filtered window holds, with how many account outcomes carry it. */
export interface ReasonCount {
  key: string
  label: string
  severity: ReasonSeverity
  count: number
}

export interface TradeLogFilters {
  exchange?: string
  action?: string
  ticker?: string
  category?: string
  strategy?: string
  /** 'success' = clean signals only, 'problem' = anything that did not fill cleanly. */
  result?: string
  from?: string
  to?: string
  /** Account-level filters — the list endpoint only. */
  outcome?: TradeLogOutcome | 'all'
  reason?: string
  /** Matched against the account name and its owner's name. */
  account?: string
  limit?: number
  offset?: number
}

export interface TradeLogsData {
  logs: TradeLogRow[]
  summary: TradeLogSummary
  pagination: { limit: number; offset: number; total: number }
  /** Distinct values across the whole table — drives the filter selects. */
  options: { tickers: string[]; strategies: string[]; reasons: ReasonCount[] }
}

/**
 * One problem grouped by cause: a reason on one account (or, for a rejected
 * signal, a reason on one coin — `account` is null and `tickers` names it).
 */
export interface SignalIssue {
  key: string
  reasonKey: string
  label: string
  severity: ReasonSeverity
  account: string | null
  uniId: string | null
  userName: string | null
  isMaster: boolean
  exchange: ExchangeKind | null
  tickers: string[]
  count: number
  firstAt: string | null
  lastAt: string | null
  lastMessage: string | null
  /** Where to fix it, when there is a page for that. */
  fix: { label: string; href: string } | null
}

export type SignalHealthStatus = 'healthy' | 'normal' | 'attention' | 'quiet'

/** The banner: how the last `hours` of signals went, whatever the page filters. */
export interface SignalHealth {
  status: SignalHealthStatus
  hours: number
  signals: number
  filled: number
  normalSkips: number
  problems: number
  /** Signals where the master was in the fan-out and did not trade, for a problem reason. */
  masterMissed: number
  lastSignalAt: string | null
  /** The top five; `issuesTotal` says how many there are. */
  issues: SignalIssue[]
  issuesTotal: number
}

export interface TradeLogIssuesData {
  signals: number
  issues: SignalIssue[]
  /** Normal skips in the same window, by reason — shown, never alarming. */
  normal: ReasonCount[]
}

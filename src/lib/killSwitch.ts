import type { AdminAsset } from '../types/admin'

/**
 * Kill switch — the client half (no React).
 *
 * Per asset: "if the MASTER account loses N trades in a row on this coin,
 * switch the coin off for everyone". The API does the counting and the
 * switching (it sets the asset's `enabled` to false and stamps `killed_at` /
 * `killed_reason`); this file only reads and words it. Turning the coin back
 * on is manual — the ordinary asset enable — and that clears the kill and
 * starts the count again from that moment.
 */

/** Fewest / most master losses in a row the API accepts. */
export const KILL_SWITCH_MIN = 1
export const KILL_SWITCH_MAX = 10

/** The count a freshly switched-on kill switch starts at. */
export const KILL_SWITCH_DEFAULT = 3

/** The kill switch as edited: on/off plus the count exactly as typed. */
export interface KillSwitchDraft {
  on: boolean
  count: string
}

/** True when the kill switch has switched this coin off and nobody has turned it back on. */
export function isKilled(asset: Pick<AdminAsset, 'enabled' | 'killed_at'>): boolean {
  return !asset.enabled && Boolean(asset.killed_at)
}

/** A typed count as a kill-switch count, or null when it is not a whole number 1–10. */
export function parseKillCount(value: string): number | null {
  const text = value.trim()
  if (!/^\d+$/.test(text)) return null
  const n = Number(text)
  return n >= KILL_SWITCH_MIN && n <= KILL_SWITCH_MAX ? n : null
}

/** The editor's starting state for a saved value (null = off, remembering the default count). */
export function killDraftFrom(saved: number | null): KillSwitchDraft {
  return { on: saved !== null, count: String(saved ?? KILL_SWITCH_DEFAULT) }
}

/** What is wrong with a draft — only an ON switch with a bad count blocks saving. */
export function killDraftError(draft: KillSwitchDraft): string | null {
  if (!draft.on || parseKillCount(draft.count) !== null) return null
  return draft.count.trim() === ''
    ? `Type how many losses in a row (${KILL_SWITCH_MIN}–${KILL_SWITCH_MAX})`
    : `Use a whole number from ${KILL_SWITCH_MIN} to ${KILL_SWITCH_MAX}`
}

/**
 * The value a draft saves: null = off, a count = on. undefined while the
 * draft has an error (fix `killDraftError` first).
 */
export function killDraftValue(draft: KillSwitchDraft): number | null | undefined {
  if (!draft.on) return null
  return parseKillCount(draft.count) ?? undefined
}

/** True when a draft differs from what is saved, as typed (so Reset has something to undo). */
export function killDraftTouched(saved: number | null, draft: KillSwitchDraft): boolean {
  const text = (d: KillSwitchDraft) => (d.on ? `on:${d.count.trim()}` : 'off')
  return text(draft) !== text(killDraftFrom(saved))
}

const lossesText = (n: number) => `${n} ${n === 1 ? 'loss' : 'losses'} in a row`
const tradesText = (n: number) => `${n} ${n === 1 ? 'trade' : 'trades'} in a row`

/**
 * The confirmation readback for one kill-switch change, or null when it does
 * not change: "Kill switch on: 3 losses in a row (was off)", "Kill switch
 * off", "Kill switch 3 → 4".
 */
export function describeKillSwitchChange(before: number | null, after: number | null): string | null {
  if (before === after) return null
  if (after === null) return 'Kill switch off'
  if (before === null) return `Kill switch on: ${lossesText(after)} (was off)`
  return `Kill switch ${before} → ${after}`
}

/**
 * What a saved change will do, in a sentence, for the same confirmation.
 * "Only losses from now on count" is promised only when the switch goes from
 * off to on — that is when the API starts counting.
 */
export function killSwitchOutcome(
  before: number | null,
  after: number | null,
  symbol: string,
): string {
  if (after === null) return `${symbol} will no longer switch itself off.`
  const rule = `If the master loses ${tradesText(after)} on ${symbol}, it switches off for everyone.`
  return before === null ? `${rule} Only losses from now on count.` : rule
}

/** The asset card's line for a kill switch that is set but has not tripped. */
export function killSwitchArmedText(losses: number): string {
  return `Kill switch: switches off after ${losses} master ${losses === 1 ? 'loss' : 'losses'} in a row`
}

/**
 * Why a killed coin is off, when the server sent no sentence of its own.
 * `losses` is the count that tripped it, if known.
 */
export function killedFallbackReason(losses: number | null): string {
  return losses
    ? `The master lost ${tradesText(losses)}.`
    : 'The master reached the losing run set for this coin.'
}

/** The "turn it back on" confirmation, shared by every place that offers it. */
export function reviveConfirmCopy(symbol: string): {
  title: string
  message: string
  confirmLabel: string
} {
  return {
    title: `Turn ${symbol} back on?`,
    message:
      'New trades start again on the next signal, and the kill switch counts the master’s losses again from now.',
    confirmLabel: 'Yes, turn it back on',
  }
}

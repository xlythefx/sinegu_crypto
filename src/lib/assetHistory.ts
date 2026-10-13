import { fmtSize, ladderShortText } from './streakSizing'
import type { AssetChangeEvent, AssetChangeRow, AssetStreakSize } from '../types/admin'

/**
 * Wording for Admin → Trading Assets → Change history (API AssetHistory):
 * one line per field that changed, in plain words — "Base size 60 → 120".
 */

export const EVENT_LABEL: Record<AssetChangeEvent, string> = {
  created: 'Added',
  updated: 'Changed',
  waiting: 'Waiting for close',
  applied: 'Went live',
  cancelled: 'Waiting change dropped',
  deleted: 'Deleted',
  kill_switch: 'Kill switch',
}

export type EventTone = 'good' | 'neutral' | 'wait' | 'muted' | 'bad'

export const EVENT_TONE: Record<AssetChangeEvent, EventTone> = {
  created: 'good',
  updated: 'neutral',
  waiting: 'wait',
  applied: 'good',
  cancelled: 'muted',
  deleted: 'bad',
  kill_switch: 'bad',
}

/** Fields in the order a person reads them — sizing first. */
const FIELDS: { key: string; label: string }[] = [
  { key: 'enabled', label: 'Trading' },
  { key: 'base_size', label: 'Base size' },
  { key: 'max_increments', label: 'Max position size' },
  { key: 'streak_sizing_enabled', label: 'Streak sizing' },
  { key: 'streak_sizes', label: 'Streak steps' },
  { key: 'kill_switch_losses', label: 'Kill switch' },
  { key: 'side', label: 'Side' },
  { key: 'ticker', label: 'Ticker' },
  { key: 'broker', label: 'Exchange' },
  { key: 'type', label: 'Type' },
  { key: 'asset_image', label: 'Logo' },
]

function isSteps(v: unknown): v is AssetStreakSize[] {
  return Array.isArray(v)
}

/** One value as a person reads it. */
export function formatValue(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') {
    if (key === 'kill_switch_losses') return 'off'
    if (key === 'streak_sizes') return 'none'
    return '—'
  }
  switch (key) {
    case 'enabled':
      return v ? 'on' : 'off'
    case 'streak_sizing_enabled':
      return v ? 'on' : 'off'
    case 'base_size':
    case 'max_increments':
      return fmtSize(Number(v))
    case 'kill_switch_losses': {
      const n = Number(v)
      return `after ${n} ${n === 1 ? 'loss' : 'losses'}`
    }
    case 'streak_sizes':
      return isSteps(v) && v.length > 0
        ? ladderShortText(
            v.map((s) => ({ kind: s.kind === 'win' ? 'win' : 'loss', streak: Number(s.streak), size: Number(s.size) })),
          )
        : 'none'
    default:
      return String(v)
  }
}

/**
 * The lines one history row shows. A new or deleted coin lists its sizing
 * as a snapshot ("Base size 60 · Max position size 180 · Trading on"); a
 * change lists from → to per field. The logo only says it changed.
 */
export function changeLines(row: AssetChangeRow): string[] {
  const changes = row.changes ?? {}
  if (row.event === 'created' || row.event === 'deleted') {
    const side = row.event === 'created' ? 'to' : 'from'
    return [
      ['base_size', 'max_increments', 'enabled']
        .filter((k) => changes[k])
        .map((k) => `${FIELDS.find((f) => f.key === k)?.label} ${formatValue(k, changes[k][side])}`)
        .join(' · '),
    ].filter(Boolean)
  }
  return FIELDS.filter((f) => changes[f.key]).map((f) => {
    const { from, to } = changes[f.key]
    if (f.key === 'asset_image') return 'Logo changed'
    if (f.key === 'enabled') return `Trading switched ${formatValue('enabled', to)}`
    return `${f.label} ${formatValue(f.key, from)} → ${formatValue(f.key, to)}`
  })
}

/** The actor as a sentence part: "by Ops Admin" / "automatically" / "by the kill switch". */
export function actorText(row: AssetChangeRow): string {
  if (!row.is_system) return `by ${row.actor_name || 'an admin'}`
  if (row.event === 'kill_switch') return 'by the kill switch'
  return 'automatically'
}

import type { AdminOpenPosition, AdminOpenPositionsData } from '../types/openPositions'
import type { ExchangeKind } from '../types/exchanges'
import type { SignalFeed } from '../types/feeds'
import { feedOf } from './feeds'

/** Selection key for an open-positions row — ids repeat across venues' tables. */
export const positionKey = (p: Pick<AdminOpenPosition, 'exchange' | 'id'>) => `${p.exchange}:${p.id}`

export interface SideRef {
  symbol: string
  side: 'LONG' | 'SHORT'
}

/**
 * `same`: holds exactly the coins + sides the master holds on that venue.
 * `differs`: something is missing or extra. `no-master`: the master has no
 * account on that venue, so there is nothing to compare against.
 * `test-feed`: a tester's account — it follows the test feed, not the
 * master's signals, so it is never compared (a "different" would be noise).
 * `submaster-feed`: the sub-master's account — same reason, its own feed.
 */
export type SyncState = 'same' | 'differs' | 'no-master' | 'test-feed' | 'submaster-feed'

export interface UserSync {
  key: string
  uni_id: string
  exchange: ExchangeKind
  owner_name: string
  account_name: string | null
  demo: boolean
  feed: SignalFeed
  positions: AdminOpenPosition[]
  /** Master holds it, this user does not. */
  missing: SideRef[]
  /** This user holds it, the master does not. */
  extra: SideRef[]
  state: SyncState
  unrealized: number
}

const ref = (p: SideRef) => `${p.symbol}|${p.side}`
const unref = (k: string): SideRef => {
  const [symbol, side] = k.split('|')
  return { symbol, side: side as SideRef['side'] }
}

const isMaster = (p: AdminOpenPosition) => p.owner_type === 'master'


type EntryInit = Pick<UserSync, 'owner_name' | 'account_name' | 'demo' | 'feed'>

/**
 * Splits the payload into the master's positions and one entry per user
 * account compared with the master ON THE SAME VENUE. Compared by coin + side
 * only: sizes scale with each balance, so a different size is not a
 * difference. Users who are flat still appear (from `accounts`), because a
 * user holding nothing while the master is in a trade is the case that
 * matters most. Out-of-sync users sort first.
 *
 * Test-feed accounts (testers) come back on their own in `testFeed`, and the
 * sub-master's in `submasterFeed`, never compared: they trade different
 * signals than the master by design.
 */
export function splitByMaster(data: AdminOpenPositionsData): {
  master: AdminOpenPosition[]
  users: UserSync[]
  testFeed: UserSync[]
  submasterFeed: UserSync[]
} {
  const master = data.positions.filter(isMaster)
  const masterSets = new Map<ExchangeKind, Set<string>>()
  for (const ex of data.master_exchanges) masterSets.set(ex, new Set())
  for (const p of master) masterSets.get(p.exchange)?.add(ref(p))

  const users = new Map<string, UserSync>()
  const entry = (exchange: ExchangeKind, uni_id: string, init: EntryInit) => {
    const key = `${exchange}:${uni_id}`
    let u = users.get(key)
    if (!u) {
      u = { key, uni_id, exchange, ...init, positions: [], missing: [], extra: [], state: 'same', unrealized: 0 }
      users.set(key, u)
    }
    // Either half of the payload may be the one that names the own feed.
    if (init.feed !== 'main') u.feed = init.feed
    return u
  }
  const initOf = (row: { owner_name: string; account_name: string | null; demo: boolean; feed?: SignalFeed }): EntryInit => ({
    owner_name: row.owner_name,
    account_name: row.account_name,
    demo: row.demo,
    // Absent on an API older than the test feed — every account was main then.
    feed: feedOf(row.feed),
  })
  for (const a of data.accounts) entry(a.exchange, a.uni_id, initOf(a))
  for (const p of data.positions) {
    if (isMaster(p)) continue
    const u = entry(p.exchange, p.uni_id, initOf(p))
    u.positions.push(p)
    u.unrealized += p.unrealized_pnl ?? 0
  }

  for (const u of users.values()) {
    if (u.feed === 'test' || u.feed === 'submaster') {
      u.state = u.feed === 'test' ? 'test-feed' : 'submaster-feed'
      continue
    }
    const target = masterSets.get(u.exchange)
    if (!target) {
      u.state = 'no-master'
      continue
    }
    const held = new Set(u.positions.map(ref))
    u.missing = [...target].filter((k) => !held.has(k)).map(unref)
    u.extra = [...held].filter((k) => !target.has(k)).map(unref)
    u.state = u.missing.length || u.extra.length ? 'differs' : 'same'
  }

  const order: Record<SyncState, number> = {
    differs: 0,
    same: 1,
    'no-master': 2,
    'test-feed': 3,
    'submaster-feed': 4,
  }
  const ownFeed = (s: SyncState) => s === 'test-feed' || s === 'submaster-feed'
  const sorted = [...users.values()].sort(
    (a, b) => order[a.state] - order[b.state] || a.owner_name.localeCompare(b.owner_name),
  )
  return {
    master,
    users: sorted.filter((u) => !ownFeed(u.state)),
    testFeed: sorted.filter((u) => u.state === 'test-feed'),
    submasterFeed: sorted.filter((u) => u.state === 'submaster-feed'),
  }
}

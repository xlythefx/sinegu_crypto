import { useMemo } from 'react'
import { useUrlFilters } from './useUrlFilters'
import { MONTH_DATE_PRESETS, type DatePreset } from '../lib/dateRange'
import type { OwnerFilter, SideFilter, StrategyFilters } from '../lib/strategyFilters'

const DEFAULTS = { coins: '', exchange: 'all', side: 'all', owner: 'all', date: 'all', from: '', to: '' }
const SIDES = ['all', 'long', 'short']
const DATE_VALUES = MONTH_DATE_PRESETS.map((p) => p.value)

function toOwner(raw: string): OwnerFilter {
  if (raw === 'master' || raw === 'customers' || raw === 'testers' || raw === 'submaster') return raw
  if (raw.startsWith('u:') && raw.length > 2) return raw as OwnerFilter
  return 'all'
}

export interface StrategyFilterState extends StrategyFilters {
  activeCount: number
  setCoins: (coins: string[]) => void
  toggleCoin: (coin: string) => void
  setExchange: (v: string) => void
  setSide: (v: SideFilter) => void
  setOwner: (v: OwnerFilter) => void
  setDate: (v: { preset: DatePreset; from: string; to: string }) => void
  resetCoin: (coin: string) => void
  resetExchange: () => void
  resetSide: () => void
  resetOwner: () => void
  resetDate: () => void
  clear: () => void
}

/**
 * The strategy pages' filters (the list and each strategy), kept in the URL
 * (`?coins=LTCUSDT,SANTOSUSDT&exchange=binance&side=short&owner=master
 * &date=month`), so Back, a refresh and a link
 * sent to a colleague open the same view. `?owner=master` is the link the
 * page's old "Master only" switch wrote, so those links still work.
 */
export function useStrategyFilters(): StrategyFilterState {
  const u = useUrlFilters(DEFAULTS, { allowed: { date: DATE_VALUES, side: SIDES } })
  const f = u.filters

  return useMemo(() => {
    const coins = f.coins ? f.coins.split(',').filter(Boolean) : []
    const writeCoins = (next: string[]) => u.set('coins', [...new Set(next)].join(','))
    const custom = f.date === 'custom'
    return {
      coins,
      exchange: f.exchange,
      side: f.side as SideFilter,
      owner: toOwner(f.owner),
      date: f.date as DatePreset,
      from: custom ? f.from : '',
      to: custom ? f.to : '',
      activeCount:
        coins.length +
        (f.exchange !== 'all' ? 1 : 0) +
        (f.side !== 'all' ? 1 : 0) +
        (toOwner(f.owner) !== 'all' ? 1 : 0) +
        (f.date !== 'all' ? 1 : 0),
      setCoins: writeCoins,
      toggleCoin: (coin) =>
        writeCoins(coins.includes(coin) ? coins.filter((c) => c !== coin) : [...coins, coin]),
      setExchange: (v) => u.set('exchange', v),
      setSide: (v) => u.set('side', v),
      setOwner: (v) => u.set('owner', v),
      setDate: ({ preset, from, to }) =>
        u.setMany(preset === 'custom' ? { date: preset, from, to } : { date: preset, from: '', to: '' }),
      resetCoin: (coin) => writeCoins(coins.filter((c) => c !== coin)),
      resetExchange: () => u.reset('exchange'),
      resetSide: () => u.reset('side'),
      resetOwner: () => u.reset('owner'),
      resetDate: () => u.setMany({ date: 'all', from: '', to: '' }),
      clear: u.clear,
    }
  }, [f, u])
}

import { LogIn, LogOut } from 'lucide-react'
import type { TradeKindWord, TradeSideWord } from '../../../types/tradeLogs'

const SIDE_TINT: Record<TradeSideWord, string> = {
  LONG: 'border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-[color-mix(in_srgb,var(--green)_12%,transparent)] text-green',
  SHORT:
    'border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)] text-red',
}

/**
 * "LONG · ENTRY" / "SHORT · EXIT" — the engine's BUY / SELL / EXIT_LONG /
 * EXIT_SHORT in plain words: green for long, red for short (the colours the
 * Positions pages use), and an arrow in or out for opening or closing.
 */
export default function SideTypePill({ side, type }: { side: TradeSideWord; type: TradeKindWord }) {
  const Icon = type === 'entry' ? LogIn : LogOut
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.06em] ${SIDE_TINT[side]}`}
      title={`${side === 'LONG' ? 'Long' : 'Short'} ${type === 'entry' ? 'entry — opens or adds to a position' : 'exit — closes the position'}`}
    >
      <Icon size={12} aria-hidden="true" />
      {side}
      <span className="opacity-60">·</span>
      {type === 'entry' ? 'Entry' : 'Exit'}
    </span>
  )
}

/** A position's direction as every screen prints it — no React.
 *
 *  Two stored columns describe it, and only one of them IS the direction:
 *  `position_side` (LONG / SHORT, or BOTH on a one-way account) is the trade,
 *  while a closed trade's `side` is the ORDER THAT CLOSED IT — a short is
 *  closed by a BUY. Printing `side` made every short read "BUY" on the admin
 *  Positions page, so it is only ever a fallback here. */

export type TradeSide = 'LONG' | 'SHORT'

function asTradeSide(v: string | null | undefined): TradeSide | null {
  const s = (v ?? '').toUpperCase()
  return s === 'LONG' || s === 'SHORT' ? s : null
}

/** A closed trade's direction: its `position_side`, else read off the closing
 *  order (SELL closes a long, BUY closes a short). */
export function closedTradeSide(
  positionSide: string | null | undefined,
  closeSide: string | null | undefined,
): TradeSide | null {
  const direct = asTradeSide(positionSide)
  if (direct) return direct
  const close = (closeSide ?? '').toUpperCase()
  if (close === 'SELL') return 'LONG'
  if (close === 'BUY') return 'SHORT'
  return null
}

/** An open position's direction: its `position_side`, else the sign of its
 *  size (a one-way account stores BOTH and a negative amount for a short). */
export function openPositionSide(
  positionSide: string | null | undefined,
  amount: number | null | undefined,
): TradeSide | null {
  const direct = asTradeSide(positionSide)
  if (direct) return direct
  if (amount == null || amount === 0 || !Number.isFinite(amount)) return null
  return amount > 0 ? 'LONG' : 'SHORT'
}

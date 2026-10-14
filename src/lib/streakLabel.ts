/** Wording for a trade sized by streak sizing — no React.
 *
 *  A customer reads only which way the size went and why ("Smaller size ·
 *  after 3 losses"); staff also read the ladder step and both sizes. The
 *  sizes never reach a trader's payload, so the customer sentence cannot leak
 *  them by construction. */

import type { TradeStreak } from '../types/dashboard'

const EFFECT_WORD: Record<TradeStreak['effect'], string> = {
  smaller: 'Smaller size',
  larger: 'Larger size',
  same: 'Streak size',
}

/** "after 3 losses" / "after a win" / "after a losing run". */
function afterRun(s: TradeStreak): string {
  const loss = s.kind === 'loss'
  if (s.run === null || s.run < 1) return loss ? 'after a losing run' : 'after a winning run'
  if (s.run === 1) return loss ? 'after a loss' : 'after a win'
  return `after ${s.run} ${loss ? 'losses' : 'wins'}`
}

/** The pill: "Smaller size · after 3 losses". */
export function streakLabel(s: TradeStreak): string {
  return `${EFFECT_WORD[s.effect]} · ${afterRun(s)}`
}

/** The full sentence behind the pill (its hover). */
export function streakSentence(s: TradeStreak): string {
  const run =
    s.run && s.run > 1
      ? `${s.run} ${s.kind === 'loss' ? 'losing' : 'winning'} trades in a row`
      : `a ${s.kind === 'loss' ? 'losing' : 'winning'} trade`
  const size =
    s.effect === 'smaller' ? 'a smaller size' : s.effect === 'larger' ? 'a larger size' : 'its streak size'
  return `After ${run} on this coin, the bot opened this trade at ${size}.`
}

/** Staff only — "size 40 instead of 60 · loss step 3"; null on a customer's
 *  payload, which carries no sizes. */
export function streakDetail(s: TradeStreak): string | null {
  if (s.size == null || s.base_size == null) return null
  const step = s.step ? ` · ${s.kind} step ${s.step}` : ''
  return `size ${trim(s.size)} instead of ${trim(s.base_size)}${step}`
}

/** 40 → "40", 0.125 → "0.125" — a typed ladder size, without padding zeros. */
function trim(n: number): string {
  return String(Number(n.toFixed(6)))
}

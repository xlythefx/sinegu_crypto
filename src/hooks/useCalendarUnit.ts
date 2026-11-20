import { useIsMobile } from './useIsMobile'
import { useStoredFlag } from './useStoredFlag'

/** One choice per device for every P&L calendar (the trader's and the admin
 *  ones), so a calendar opens the way it was last read. */
const SHOW_PCT_KEY = 'pixel-alpha.calendar.show-pct'

/**
 * The Daily P&L Calendar's $ / % switch. `pctDp` is the decimals a cell can
 * fit: a phone's cell has ~25px of text width, where "+0.28%" spills over the
 * edge and "+0.3%" fits. Day popups still print two decimals.
 */
export function useCalendarUnit() {
  const [showPct, setShowPct] = useStoredFlag(SHOW_PCT_KEY, false)
  const pctDp = useIsMobile(480) ? 1 : 2
  return { showPct, setShowPct, pctDp }
}

import { useContext } from 'react'
import { Menu } from 'lucide-react'
import { useTheme } from '../../theme'
import { useSessionUser } from '../../hooks/useSessionUser'
import {
  useExchangeFilter,
  type ExchangeFilter,
} from '../../context/ExchangeFilterContext'
import UserAvatar from '../ui/UserAvatar'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../exchanges/meta'
import { ShellContext } from './DashboardShell'
import {
  TOPBAR,
  BURGER,
  TOPBAR_RIGHT,
  FILTER,
  FILTER_PILL_BASE,
  FILTER_PILL_OFF,
  FILTER_PILL_ON,
  FILTER_DOT,
  THEME_TOGGLE,
  THEME_TOGGLE_ICON,
} from './shellClasses'

/** Kept for older imports — the filter's type now lives with its context. */
export type ExchangeKey = ExchangeFilter

// Venues not yet connectable (EXCHANGE_META.available) stay visible but disabled.
const EXCHANGES: { key: ExchangeFilter; label: string; dot: string; soon?: boolean }[] = [
  { key: 'all', label: 'All', dot: 'var(--accent)' },
  ...EXCHANGE_ORDER.map((key) => ({
    key,
    label: EXCHANGE_META[key].label,
    dot: EXCHANGE_META[key].color,
    soon: !EXCHANGE_META[key].available,
  })),
]

/**
 * Page top bar: burger (mobile) left; exchange filter, theme toggle and
 * avatar right. The exchange pills are the page's data scope, not decoration:
 * they write the shared filter every dashboard read passes to the API.
 */
export default function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const { openDrawer } = useContext(ShellContext)
  const { exchange, setExchange } = useExchangeFilter()
  const user = useSessionUser()

  return (
    <div className={TOPBAR}>
      <button
        type="button"
        className={BURGER}
        onClick={openDrawer}
        aria-label="Open menu"
      >
        <Menu size={20} strokeWidth={2.2} />
      </button>
      <div className={TOPBAR_RIGHT}>
        <div className={FILTER}>
          {EXCHANGES.map((e) => (
            <button
              key={e.key}
              type="button"
              className={`${FILTER_PILL_BASE} ${exchange === e.key ? FILTER_PILL_ON : FILTER_PILL_OFF}`}
              onClick={() => setExchange(e.key)}
              disabled={e.soon}
              aria-pressed={exchange === e.key}
              title={e.soon ? 'Coming soon' : `Show ${e.label === 'All' ? 'every exchange' : `${e.label} only`}`}
            >
              <span className={FILTER_DOT} style={{ background: e.dot }} />
              {e.label}
            </button>
          ))}
        </div>
        <button
          className={THEME_TOGGLE}
          title="Toggle theme"
          onClick={toggleTheme}
        >
          <span className={THEME_TOGGLE_ICON}>
            {theme === 'dark' ? '☀' : '☾'}
          </span>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <UserAvatar user={user} size={34} />
      </div>
    </div>
  )
}

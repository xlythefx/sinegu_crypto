import { useContext, useState } from 'react'
import { Menu } from 'lucide-react'
import { useTheme } from '../../theme'
import { useSessionUser } from '../../hooks/useSessionUser'
import UserAvatar from '../ui/UserAvatar'
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

export type ExchangeKey = 'all' | 'binance' | 'bybit' | 'mexc'

// Bybit / MEXC are not integrated yet — pills stay visible but disabled.
const EXCHANGES: { key: ExchangeKey; label: string; dot: string; soon?: boolean }[] = [
  { key: 'all', label: 'All', dot: 'var(--accent)' },
  { key: 'binance', label: 'Binance', dot: '#f0b90b' },
  { key: 'bybit', label: 'Bybit', dot: '#f7a600', soon: true },
  { key: 'mexc', label: 'MEXC', dot: '#1972e2', soon: true },
]

/** Page top bar: burger (mobile) left; exchange filter, theme toggle and avatar right. */
export default function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const { openDrawer } = useContext(ShellContext)
  const [exchange, setExchange] = useState<ExchangeKey>('all')
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
              title={e.soon ? 'Coming soon' : undefined}
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

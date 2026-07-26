import { useContext, useState } from 'react'
import { Menu } from 'lucide-react'
import { useTheme } from '../../theme'
import { useSessionUser } from '../../hooks/useSessionUser'
import UserAvatar from '../ui/UserAvatar'
import { ShellContext } from './DashboardShell'

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
    <div className="dtb">
      <button
        type="button"
        className="dtb__burger"
        onClick={openDrawer}
        aria-label="Open menu"
      >
        <Menu size={20} strokeWidth={2.2} />
      </button>
      <div className="dtb__right">
        <div className="dtb__filter">
          {EXCHANGES.map((e) => (
            <button
              key={e.key}
              type="button"
              className={`dtb__filter-pill${exchange === e.key ? ' dtb__filter-pill--active' : ''}`}
              onClick={() => setExchange(e.key)}
              disabled={e.soon}
              title={e.soon ? 'Coming soon' : undefined}
            >
              <span className="dtb__filter-dot" style={{ background: e.dot }} />
              {e.label}
            </button>
          ))}
        </div>
        <button
          className="theme-toggle"
          title="Toggle theme"
          onClick={toggleTheme}
        >
          <span className="theme-toggle__icon">
            {theme === 'dark' ? '☀' : '☾'}
          </span>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <UserAvatar user={user} size={34} />
      </div>
    </div>
  )
}

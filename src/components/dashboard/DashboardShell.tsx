import { createContext, useState, type ReactNode } from 'react'

/** Lets descendants (the TopBar burger) open the mobile sidebar drawer. */
// eslint-disable-next-line react-refresh/only-export-components
export const ShellContext = createContext<{ openDrawer: () => void }>({
  openDrawer: () => {},
})

interface DashboardShellProps {
  sidebar: ReactNode
  children: ReactNode
}

/**
 * App shell for the trader dashboard: full-height flex row of
 * [sidebar][content]. On phones the sidebar becomes an off-canvas drawer
 * behind a burger button in the TopBar.
 */
export default function DashboardShell({
  sidebar,
  children,
}: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className={`dsh${drawerOpen ? ' dsh--drawer-open' : ''}`}>
      <ShellContext.Provider value={{ openDrawer: () => setDrawerOpen(true) }}>
        {sidebar}
        {drawerOpen && (
          <div
            className="dsh__backdrop"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
        )}
        <main className="dsh__main">{children}</main>
      </ShellContext.Provider>
    </div>
  )
}

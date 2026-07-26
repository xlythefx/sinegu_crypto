import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './theme'
import { PortalSwitchProvider } from './components/ui/PortalSwitchOverlay'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Positions from './pages/Positions'
import Exchanges from './pages/Exchanges'
import Settings from './pages/Settings'
import Analytics from './pages/Analytics'
import StrategyDetail from './pages/StrategyDetail'
import AssetPerformance from './pages/AssetPerformance'
import Invoices from './pages/Invoices'
import InvoiceDetail from './pages/InvoiceDetail'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminAssets from './pages/admin/AdminAssets'
import AdminUsers from './pages/admin/AdminUsers'
import AdminStrategies from './pages/admin/AdminStrategies'
import AdminSandbox from './pages/admin/AdminSandbox'
import AdminStrategyDetail from './pages/admin/AdminStrategyDetail'
import AdminPositions from './pages/admin/AdminPositions'
import AdminInvoiceHistory from './pages/admin/AdminInvoiceHistory'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <PortalSwitchProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard/analytics" element={<Analytics />} />
            <Route path="/dashboard/strategies/:strategyKey" element={<StrategyDetail />} />
            <Route path="/dashboard/positions" element={<Positions />} />
            <Route path="/dashboard/exchanges" element={<Exchanges />} />
            <Route path="/dashboard/asset-performance" element={<AssetPerformance />} />
            <Route path="/dashboard/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/dashboard/invoices" element={<Invoices />} />
            <Route path="/dashboard/settings" element={<Settings />} />
            <Route path="/dashboard/*" element={<Dashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/strategies/:key" element={<AdminStrategyDetail />} />
            <Route path="/admin/strategies" element={<AdminStrategies />} />
            <Route path="/admin/assets" element={<AdminAssets />} />
            <Route path="/admin/positions" element={<AdminPositions />} />
            <Route path="/admin/invoices" element={<AdminInvoiceHistory />} />
            <Route path="/admin/sandbox" element={<AdminSandbox />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
          </Routes>
        </PortalSwitchProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

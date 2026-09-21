import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './theme'
import { PortalSwitchProvider } from './components/ui/PortalSwitchOverlay'
import ProdApiBadge from './components/ui/ProdApiBadge'
import Landing from './pages/Landing'
import LandingV2 from './pages/LandingV2'
import Auth from './pages/Auth'
import ForgotPassword from './pages/ForgotPassword'
import DiscordStart from './pages/DiscordStart'
import DiscordCallback from './pages/DiscordCallback'
import DiscordTerms from './pages/DiscordTerms'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import RiskDisclosure from './pages/RiskDisclosure'
import Contact from './pages/Contact'
import Faq from './pages/Faq'
import NotFound from './pages/NotFound'
import TradingBot from './pages/TradingBot'
import BinanceGuide from './pages/BinanceGuide'
import Dashboard from './pages/Dashboard'
import Positions from './pages/Positions'
import Exchanges from './pages/Exchanges'
import ConnectExchange from './pages/ConnectExchange'
import Settings from './pages/Settings'
import Analytics from './pages/Analytics'
import StrategyDetail from './pages/StrategyDetail'
import AssetPerformance from './pages/AssetPerformance'
import Invoices from './pages/Invoices'
import InvoiceDetail from './pages/InvoiceDetail'
import Referrals from './pages/Referrals'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminAssets from './pages/admin/AdminAssets'
import AdminUsers from './pages/admin/AdminUsers'
import AdminApiKeys from './pages/admin/AdminApiKeys'
import AdminUserDetail from './pages/admin/AdminUserDetail'
import AdminStrategies from './pages/admin/AdminStrategies'
import AdminSandbox from './pages/admin/AdminSandbox'
import AdminManualTrade from './pages/admin/AdminManualTrade'
import AdminStrategyDetail from './pages/admin/AdminStrategyDetail'
import AdminPositions from './pages/admin/AdminPositions'
import AdminEngine from './pages/admin/AdminEngine'
import AdminTradeLogs from './pages/admin/AdminTradeLogs'
import AdminInvoiceHistory from './pages/admin/AdminInvoiceHistory'
import AdminResources from './pages/admin/AdminResources'
import AdminDatabase from './pages/admin/AdminDatabase'
import AdminTronTransfers from './pages/admin/AdminTronTransfers'
import AdminReferrals from './pages/admin/AdminReferrals'
import AdminReleasePayment from './pages/admin/AdminReleasePayment'
import AdminTodo from './pages/admin/AdminTodo'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <PortalSwitchProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/v2" element={<LandingV2 />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/forgot" element={<ForgotPassword />} />
            <Route path="/auth/discord/start" element={<DiscordStart />} />
            <Route path="/auth/discord/callback" element={<DiscordCallback />} />
            <Route path="/auth/discord/terms" element={<DiscordTerms />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/risk" element={<RiskDisclosure />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/trading-bot" element={<TradingBot />} />
            <Route path="/docs/binance" element={<BinanceGuide />} />
            <Route path="/dashboard/analytics" element={<Analytics />} />
            <Route path="/dashboard/strategies/:strategyKey" element={<StrategyDetail />} />
            <Route path="/dashboard/positions" element={<Positions />} />
            <Route path="/dashboard/exchanges/connect" element={<ConnectExchange />} />
            <Route path="/dashboard/exchanges" element={<Exchanges />} />
            <Route path="/dashboard/asset-performance" element={<AssetPerformance />} />
            <Route path="/dashboard/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/dashboard/invoices" element={<Invoices />} />
            <Route path="/dashboard/referrals" element={<Referrals />} />
            <Route path="/dashboard/settings" element={<Settings />} />
            <Route path="/dashboard/*" element={<Dashboard />} />
            <Route path="/admin/users/:uniId" element={<AdminUserDetail />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/api-keys" element={<AdminApiKeys />} />
            <Route path="/admin/strategies/:key" element={<AdminStrategyDetail />} />
            <Route path="/admin/strategies" element={<AdminStrategies />} />
            <Route path="/admin/assets" element={<AdminAssets />} />
            <Route path="/admin/positions" element={<AdminPositions />} />
            <Route path="/admin/engine" element={<AdminEngine />} />
            <Route path="/admin/trade-logs" element={<AdminTradeLogs />} />
            <Route path="/admin/invoices" element={<AdminInvoiceHistory />} />
            <Route path="/admin/referrals/release/:referrerUniId" element={<AdminReleasePayment />} />
            <Route path="/admin/referrals" element={<AdminReferrals />} />
            <Route path="/admin/sandbox/manual-trade" element={<AdminManualTrade />} />
            <Route path="/admin/sandbox" element={<AdminSandbox />} />
            <Route path="/admin/resources" element={<AdminResources />} />
            <Route path="/admin/database" element={<AdminDatabase />} />
            <Route path="/admin/tron-transfers" element={<AdminTronTransfers />} />
            <Route path="/admin/todo" element={<AdminTodo />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ProdApiBadge />
        </PortalSwitchProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App

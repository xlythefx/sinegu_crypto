import DashboardLayout from '../components/dashboard/DashboardLayout'
import ProfileHeaderCard from '../components/settings/ProfileHeaderCard'
import AccountInfoCard from '../components/settings/AccountInfoCard'
import PaymentMethodCard from '../components/settings/PaymentMethodCard'
import CryptoWalletCard from '../components/settings/CryptoWalletCard'
import BankWireCard from '../components/settings/BankWireCard'
import PasswordChangeCard from '../components/settings/PasswordChangeCard'
import DangerZoneCard from '../components/settings/DangerZoneCard'
import { useMe } from '../hooks/useMe'
import './Settings.css'

export default function Settings() {
  const { user, setUser, loading } = useMe()

  return (
    <DashboardLayout title="Settings">
      <div className="set-head" data-aos="fade-up">
        <p className="set-head__kicker mono">ACCOUNT</p>
        <h1 className="set-head__title">Settings</h1>
        <p className="set-head__sub">
          Manage your profile, payout methods, and security.
        </p>
      </div>

      <ProfileHeaderCard user={user} />

      <div className="set-grid">
        <AccountInfoCard user={user} loading={loading} onUserChange={setUser} />
        <PaymentMethodCard />
        <CryptoWalletCard />
      </div>

      <BankWireCard />
      <PasswordChangeCard email={user?.email ?? ''} />
      <DangerZoneCard />
    </DashboardLayout>
  )
}

import DashboardLayout from '../components/dashboard/DashboardLayout'
import ProfileHeaderCard from '../components/settings/ProfileHeaderCard'
import AccountInfoCard from '../components/settings/AccountInfoCard'
import PaymentMethodCard from '../components/settings/PaymentMethodCard'
import CryptoWalletCard from '../components/settings/CryptoWalletCard'
import BankWireCard from '../components/settings/BankWireCard'
import PasswordChangeCard from '../components/settings/PasswordChangeCard'
import DangerZoneCard from '../components/settings/DangerZoneCard'
import { useMe } from '../hooks/useMe'

export default function Settings() {
  const { user, setUser, loading } = useMe()

  return (
    <DashboardLayout title="Settings">
      <div className="mb-[18px]" data-aos="fade-up">
        <p className="font-mono text-[11px] tracking-[0.12em] text-accent">
          ACCOUNT
        </p>
        <h1 className="font-display text-[24px] font-extrabold tracking-[-0.02em] mt-1">
          Settings
        </h1>
        <p className="text-[13px] text-muted mt-0.5">
          Manage your profile, payout methods, and security.
        </p>
      </div>

      <ProfileHeaderCard user={user} />

      <div className="grid grid-cols-3 gap-4 items-stretch mb-4 max-[1100px]:grid-cols-1">
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

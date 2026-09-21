import DashboardLayout from '../components/dashboard/DashboardLayout'
import ProfileHeaderCard from '../components/settings/ProfileHeaderCard'
import AccountInfoCard from '../components/settings/AccountInfoCard'
import CryptoWalletCard from '../components/settings/CryptoWalletCard'
import BankWireCard from '../components/settings/BankWireCard'
import PasswordChangeCard from '../components/settings/PasswordChangeCard'
import DiscordCard from '../components/settings/DiscordCard'
import DangerZoneCard from '../components/settings/DangerZoneCard'
import { getUser } from '../lib/session'
import { useMe } from '../hooks/useMe'
import { useApiData } from '../hooks/useApiData'
import { getPayoutMethods } from '../services/payoutMethods'
import { getApiErrorMessage } from '../services/api'

export default function Settings() {
  const { user, setUser, loading } = useMe()
  // Payout methods (wallets + bank wire) — fetched once, shared by both cards.
  const payout = useApiData(getPayoutMethods)
  const payoutError = payout.error
    ? getApiErrorMessage(payout.error, 'Could not load your payout methods.')
    : null

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

      {/*
        Payment Method (card on file) is hidden until Stripe lands — the feature
        does not exist yet on sinegutrade-api. Re-add <PaymentMethodCard /> here
        (and go back to grid-cols-3) once saved cards are live.
      */}
      <div className="grid grid-cols-2 gap-4 items-stretch mb-4 max-[1100px]:grid-cols-1">
        <AccountInfoCard user={user} loading={loading} onUserChange={setUser} />
        <CryptoWalletCard
          wallets={payout.data?.wallets ?? null}
          loadError={payoutError}
          onChanged={payout.reload}
        />
      </div>

      <BankWireCard
        accounts={payout.data?.bankAccounts ?? null}
        loadError={payoutError}
        onChanged={payout.reload}
      />
      <DiscordCard user={user} onUserChange={setUser} />
      {/*
        A Discord-only account has no password to change; it gets "Set a
        password" instead, and flips to the change card once one exists.
      */}
      <PasswordChangeCard
        email={user?.email ?? ''}
        mode={user?.has_password === false ? 'set' : 'change'}
        onChanged={() => {
          const refreshed = getUser()
          if (refreshed) setUser(refreshed)
        }}
      />
      <DangerZoneCard />
    </DashboardLayout>
  )
}

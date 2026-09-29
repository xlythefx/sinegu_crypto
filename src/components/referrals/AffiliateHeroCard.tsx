import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Check,
  Copy,
  HelpCircle,
  Link2,
  Pencil,
  Sparkles,
  Star,
  Ticket,
  Wallet,
} from 'lucide-react'
import CopyState from '../ui/CopyState'
import { createReferralCode } from '../../services/referrals'
import { setMainPayoutMethod } from '../../services/payoutMethods'
import { getApiErrorMessage } from '../../services/api'
import { truncateAddress } from '../../lib/referrals'
import type {
  BankWireAccount,
  CryptoWallet,
  CommunityDetails,
  ReferralsData,
} from '../../types/referrals'

interface AffiliateHeroCardProps {
  data: ReferralsData
  wallets: CryptoWallet[]
  bankAccounts: BankWireAccount[]
  methodsLoading: boolean
  methodsError: unknown
  /** Reload the referrals payload after a code was generated. */
  onCodeGenerated: () => void
  /** Open the community setup dialog. */
  onEditCommunity: () => void
  /** Reload payout methods after set-main. */
  onMethodsChanged: () => void
}

/* ---------- shared idiom ---------- */
const BLOCK_LABEL =
  'flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] uppercase text-faint mb-2 [&_svg]:text-accent [&_svg]:flex-none'
const READONLY_INPUT =
  'w-full h-10 px-3 border border-border rounded-field bg-surface2 text-text font-mono text-[13px] outline-none'
const ICON_BTN =
  'inline-flex items-center justify-center w-[34px] h-[34px] rounded-btn border border-border bg-surface2 text-muted cursor-pointer flex-none transition-[background,color,border-color] duration-150 hover:text-accent hover:border-accent-line'
const ERROR_TEXT = 'text-[12px] text-red mt-2'

/** Copy-to-clipboard with a 1.5s Check confirmation. */
function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return { copied, copy }
}

/* ---------- blocks ---------- */

function AffiliateCodeBlock({
  code,
  onGenerated,
}: {
  code: string | null
  onGenerated: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { copied, copy } = useCopy()

  const generate = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await createReferralCode()
      onGenerated()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not generate your referral code.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className={BLOCK_LABEL}>
        <Ticket size={13} />
        Your referral code
      </p>
      {code ? (
        <div className="flex items-center gap-2">
          <input
            className={`${READONLY_INPUT} font-bold tracking-[0.14em]`}
            value={code}
            readOnly
            aria-label="Referral code"
          />
          <button
            type="button"
            className={ICON_BTN}
            onClick={() => copy(code)}
            title="Copy code"
            aria-label="Copy referral code"
          >
            {copied ? <Check size={15} className="text-green" /> : <Copy size={15} />}
          </button>
        </div>
      ) : (
        <>
          <p className="text-[13px] text-muted mb-3 leading-[1.55]">
            Generate your personal code to start inviting traders and earning
            commission on their fees.
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-field border border-transparent bg-accent text-on-accent text-[13px] font-bold cursor-pointer shadow-[0_8px_20px_var(--glow)] transition-[filter] duration-150 hover:brightness-[1.06] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={generate}
            disabled={busy}
          >
            <Sparkles size={14} />
            {busy ? 'Generating…' : 'Generate referral code'}
          </button>
        </>
      )}
      {error && (
        <p className={ERROR_TEXT} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function InviteLinkBlock({ code }: { code: string }) {
  const { copied, copy } = useCopy()
  const link = `${window.location.origin}/auth?ref=${code}`

  return (
    <div>
      <p className={BLOCK_LABEL}>
        <Link2 size={13} />
        Invite link
      </p>
      <div className="flex items-center gap-2">
        <input
          className={`${READONLY_INPUT} text-[12px] text-muted`}
          value={link}
          readOnly
          aria-label="Invite link"
        />
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-field border border-border bg-surface2 text-text text-[12.5px] font-bold cursor-pointer flex-none transition-[border-color,color] duration-150 hover:border-accent-line hover:text-accent"
          onClick={() => copy(link)}
        >
          <CopyState copied={copied} size={14} label="Copy link" checkClassName="text-green" />
        </button>
      </div>
      <p className="text-[11.5px] text-faint mt-1.5">
        New sign-ups through this link join your network automatically.
      </p>
    </div>
  )
}

function CommissionBlock({ pct }: { pct: number | null }) {
  return (
    <div>
      <p className={BLOCK_LABEL}>
        Commission rate
        <span
          title="Your commission is earned on the fees your referred traders pay. The rate is set by the platform for your account."
          className="inline-flex cursor-help"
        >
          <HelpCircle size={13} />
        </span>
      </p>
      <p className="font-display text-[28px] font-extrabold leading-none text-accent">
        {pct != null ? `${pct}%` : '—'}
      </p>
      <p className="text-[11.5px] text-faint mt-1.5">
        Earned on every fee your referred traders pay.
      </p>
    </div>
  )
}

function CommunityBlock({
  community,
  onEdit,
}: {
  community: CommunityDetails | null
  onEdit: () => void
}) {
  const bio = community?.bio ?? ''
  const shortBio = bio.length > 50 ? `${bio.slice(0, 50)}…` : bio

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className={`${BLOCK_LABEL} mb-0`}>Community</p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-field border border-border bg-surface2 text-text text-[12px] font-bold cursor-pointer flex-none transition-[border-color,color] duration-150 hover:border-accent-line hover:text-accent"
          onClick={onEdit}
        >
          <Pencil size={12} />
          {community ? 'Edit' : 'Set up'}
        </button>
      </div>
      {community ? (
        <>
          <p className="text-[15px] font-bold text-text">
            {community.communityName || 'Your community'}
          </p>
          <p className="text-[12.5px] text-muted mt-1 leading-[1.55]">
            {shortBio || 'No bio yet.'}
          </p>
        </>
      ) : (
        <p className="text-[12.5px] text-muted leading-[1.55]">
          Give your community a name and a short bio so invited traders know
          who they are joining.
        </p>
      )}
    </div>
  )
}

function PayoutMethodsBlock({
  wallets,
  bankAccounts,
  loading,
  loadError,
  onChanged,
}: {
  wallets: CryptoWallet[]
  bankAccounts: BankWireAccount[]
  loading: boolean
  loadError: unknown
  onChanged: () => void
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleCopy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedKey(key)
    window.setTimeout(
      () => setCopiedKey((current) => (current === key ? null : current)),
      1500,
    )
  }

  const handleSetMain = async (
    type: 'wallet' | 'bank',
    id: number,
    isMain: boolean,
  ) => {
    if (isMain || busyKey != null) return
    const key = `${type}-${id}`
    setBusyKey(key)
    setError(null)
    try {
      await setMainPayoutMethod(type, id)
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update the main payout method.'))
    } finally {
      setBusyKey(null)
    }
  }

  const isEmpty = wallets.length === 0 && bankAccounts.length === 0

  const row = (
    key: string,
    icon: ReactNode,
    title: string,
    sub: string,
    copyValue: string | null,
    type: 'wallet' | 'bank',
    id: number,
    isMain: boolean,
  ) => (
    <div
      key={key}
      className="flex items-center gap-2.5 p-2.5 border border-border rounded-row bg-surface2 transition-[border-color] duration-150 hover:border-accent-line"
    >
      <span className="w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-bold overflow-hidden text-ellipsis whitespace-nowrap">
          {title}
        </p>
        <p className="font-mono text-[11px] text-muted mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
          {sub}
        </p>
      </div>
      {copyValue && (
        <button
          type="button"
          className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-btn bg-transparent text-muted cursor-pointer flex-none transition-[background,color] duration-150 hover:text-accent hover:bg-accent-soft"
          onClick={() => handleCopy(key, copyValue)}
          title="Copy"
          aria-label={`Copy ${title}`}
        >
          {copiedKey === key ? (
            <Check size={14} className="text-green" />
          ) : (
            <Copy size={14} />
          )}
        </button>
      )}
      <button
        type="button"
        className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-btn bg-transparent cursor-pointer flex-none transition-[background,color] duration-150 disabled:cursor-default ${
          isMain ? 'text-accent' : 'text-muted hover:text-accent hover:bg-accent-soft'
        }`}
        onClick={() => void handleSetMain(type, id, isMain)}
        disabled={busyKey != null}
        title={isMain ? 'Main payout method' : 'Set as main'}
        aria-label={isMain ? 'Main payout method' : `Set ${title} as main`}
      >
        <Star size={14} fill={isMain ? 'currentColor' : 'none'} />
      </button>
    </div>
  )

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className={`${BLOCK_LABEL} mb-0`}>Payout methods</p>
        <Link
          to="/dashboard/settings"
          className="text-[12px] font-bold text-accent hover:underline"
        >
          Manage
        </Link>
      </div>

      {loading ? (
        <p className="text-[12.5px] text-muted py-3 animate-[pulse_1.6s_ease-in-out_infinite]">
          Loading payout methods…
        </p>
      ) : loadError ? (
        <p className="text-[12.5px] text-red py-1" role="alert">
          {getApiErrorMessage(loadError, 'Could not load your payout methods.')}
        </p>
      ) : isEmpty ? (
        <p className="text-[12.5px] text-muted leading-[1.55]">
          No payout methods yet —{' '}
          <Link to="/dashboard/settings" className="font-bold text-accent">
            add one in Settings
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {wallets.map((w) =>
            row(
              `wallet-${w.id}`,
              <Wallet size={14} />,
              w.name || 'USDT wallet',
              `${w.network} · ${truncateAddress(w.address)}`,
              w.address,
              'wallet',
              w.id,
              w.isMain,
            ),
          )}
          {bankAccounts.map((b) =>
            row(
              `bank-${b.id}`,
              <Building2 size={14} />,
              b.label || b.accountHolder || 'Bank account',
              `${b.currency} · ${b.bankName ?? 'Bank wire'}`,
              b.iban ?? b.accountNumber,
              'bank',
              b.id,
              b.isMain,
            ),
          )}
        </div>
      )}
      {error && (
        <p className={ERROR_TEXT} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The invite hero: referral code, invite link, commission rate, community
 * profile, and payout methods — 2 columns on desktop, stacked on mobile.
 */
export default function AffiliateHeroCard({
  data,
  wallets,
  bankAccounts,
  methodsLoading,
  methodsError,
  onCodeGenerated,
  onEditCommunity,
  onMethodsChanged,
}: AffiliateHeroCardProps) {
  return (
    <section
      className="rounded-card border border-border bg-surface p-card mb-[22px]"
      data-aos="fade-up"
      data-aos-delay="120"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <AffiliateCodeBlock code={data.code} onGenerated={onCodeGenerated} />
          {data.code && <InviteLinkBlock code={data.code} />}
          <CommissionBlock pct={data.affiliatePercentage} />
        </div>
        <div className="flex flex-col gap-5 border-t border-hair pt-5 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-6">
          <CommunityBlock community={data.community} onEdit={onEditCommunity} />
          <PayoutMethodsBlock
            wallets={wallets}
            bankAccounts={bankAccounts}
            loading={methodsLoading}
            loadError={methodsError}
            onChanged={onMethodsChanged}
          />
        </div>
      </div>
    </section>
  )
}

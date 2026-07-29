import type { ExchangeKind } from './exchanges'

/** User-surface member status (the backend maps internal "overdue" → "suspended" here). */
export type MemberStatus = 'new' | 'active' | 'suspended'
/** Admin-surface member status (same rule, admin label). */
export type AdminMemberStatus = 'new' | 'active' | 'overdue'
export type PaymentReleaseStatus = 'n_a' | 'pending' | 'partial' | 'paid'
export type PayoutStatus = 'pending' | 'paid' | 'rejected'
export type PaymentMethod = 'crypto' | 'bank_wire'

export interface ExchangeBreakdown {
  exchange: ExchangeKind
  paidFee: number
  pendingFee: number
  paidCommission: number
  pendingCommission: number
  releasedCommission: number
  unreleasedCommission: number
  hasOverdue: boolean
}

interface ReferralMemberBase {
  userUniId: string
  name: string
  referredAt: string | null
  lastEarnings: number | null
  lastEarningsMonth: string | null
  fee: number | null
  /** Server-computed commission on lastEarnings — the client never multiplies. */
  yourFee: number | null
  paymentStatus: 'pending' | 'paid' | null
  paymentReleaseStatus: PaymentReleaseStatus
  breakdown: ExchangeBreakdown[]
  realizedPnl: number
  unrealizedPnl: number
  realizedPercentage: number | null
  unrealizedPercentage: number | null
}

export interface ReferralMember extends ReferralMemberBase {
  status: MemberStatus
}

export interface AdminReferralMember extends ReferralMemberBase {
  status: AdminMemberStatus
}

/** All server-computed (spec §6.1). */
export interface ReferralStats {
  totalReferrals: number
  activeReferrals: number
  lifetimeEarnings: number
  lastPayoutAt: string | null
  /** Σ releasable commission — paid invoices, not yet released. */
  pendingPayout: number
  /** Σ commission on unpaid (pending/overdue/failed) invoices. */
  projectedCommission: number
}

export interface CommunityDetails {
  communityName: string
  bio: string
  profileBanner: string | null
  profileImage: string | null
}

export interface ReferralsData {
  code: string | null
  referralId: number | null
  affiliatePercentage: number | null
  community: CommunityDetails | null
  stats: ReferralStats
  members: ReferralMember[]
}

export interface ReleasedPayout {
  id: number
  monthYear: string | null
  totalAmount: number
  payoutAddress: string
  txHash: string | null
  paymentMethod: PaymentMethod
  hasProof: boolean
  paidAt: string | null
  status: PayoutStatus
  itemsCount: number | null
}

export interface CryptoWallet {
  id: number
  network: string
  address: string
  name: string
  isMain: boolean
}

export interface BankWireAccount {
  id: number
  label: string
  accountHolder: string | null
  bankName: string | null
  accountNumber: string | null
  routingNumber: string | null
  iban: string | null
  swiftBic: string | null
  accountType: string | null
  bankAddress: string | null
  currency: string
  isMain: boolean
}

// ── Admin side ──────────────────────────────────────────────────────────────

export interface AdminReferrer {
  referralId: number
  code: string
  userUniId: string
  referrerName: string
  referrerEmail: string
  affiliatePercentage: number | null
  communityName: string | null
  referrals: AdminReferralMember[]
  referrerOverdue: boolean
  referrerPending: boolean
  totalCommissionEarned: number
  releasableCommissionTotal: number
  projectedCommissionTotal: number
  hasReleasable: boolean
  hasReleased: boolean
}

export interface AdminLedgerPayout extends ReleasedPayout {
  referrerUniId: string
  referrerName: string
  referrerEmail: string | null
}

/** One releasable line — identity is the (user, exchange, month) triple, never an invoice id. */
export interface ReleasableLine {
  referredUserUniId: string
  referredName: string
  exchange: ExchangeKind
  monthYear: string
  feePaid: number
  commission: number
}

export interface ReleasableData {
  items: ReleasableLine[]
  wallets: CryptoWallet[]
  bankAccounts: BankWireAccount[]
  referrerName: string
  referrerCode: string | null
  affiliatePercentage: number | null
}

/** The release submit unit — sent snake_case, exactly as the API expects. */
export interface ReleaseTriple {
  referred_user_uni_id: string
  exchange: ExchangeKind
  month_year: string
}

export interface LedgerStats {
  totalSentCount: number
  totalSentAmount: number
}

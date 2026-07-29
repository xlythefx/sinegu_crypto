import type { ExchangeKind } from '../types/exchanges'
import type {
  AdminLedgerPayout,
  AdminMemberStatus,
  AdminReferralMember,
  AdminReferrer,
  BankWireAccount,
  CommunityDetails,
  CryptoWallet,
  ExchangeBreakdown,
  MemberStatus,
  PaymentMethod,
  PaymentReleaseStatus,
  PayoutStatus,
  ReferralMember,
  ReferralStats,
  ReleasableLine,
  ReleasedPayout,
} from '../types/referrals'

// ── API row shapes (snake_case, exactly what sinegutrade-api returns) ───────

export interface ApiExchangeBreakdown {
  exchange: ExchangeKind
  paid_fee: number
  pending_fee: number
  paid_commission: number
  pending_commission: number
  released_commission: number
  unreleased_commission: number
  has_overdue: boolean
}

export interface ApiReferralMember {
  user_uni_id: string
  name: string
  referred_at: string | null
  status: string
  last_earnings: number | null
  last_earnings_month: string | null
  fee: number | null
  your_fee: number | null
  payment_status: 'pending' | 'paid' | null
  payment_release_status: PaymentReleaseStatus
  broker_breakdown: ApiExchangeBreakdown[]
  realized_pnl: number
  unrealized_pnl: number
  realized_percentage: number | null
  unrealized_percentage: number | null
}

export interface ApiReferralStats {
  total_referrals: number
  active_referrals: number
  lifetime_earnings: number
  last_payout_at: string | null
  pending_payout: number
  projected_commission: number
}

export interface ApiCommunity {
  community_name: string
  bio: string
  profile_banner: string | null
  profile_image: string | null
}

export interface ApiReleasedPayout {
  id: number
  referrer_uni_id: string
  month_year: string | null
  total_amount: number
  payout_address: string
  tx_hash: string | null
  payment_method: PaymentMethod
  has_proof: boolean
  paid_at: string | null
  status: PayoutStatus
  items_count: number | null
}

export interface ApiCryptoWallet {
  id: number
  network: string
  address: string
  name: string
  is_main: boolean
}

export interface ApiBankWireAccount {
  id: number
  label: string
  account_holder: string | null
  bank_name: string | null
  account_number: string | null
  routing_number: string | null
  iban: string | null
  swift_bic: string | null
  account_type: string | null
  bank_address: string | null
  currency: string
  is_main: boolean
}

export interface ApiAdminReferrer {
  referral_id: number
  code: string
  user_uni_id: string
  referrer_name: string
  referrer_email: string
  affiliate_percentage: number | null
  community_name: string | null
  referrals: ApiReferralMember[]
  referrer_overdue: boolean
  referrer_pending: boolean
  total_commission_earned: number
  releasable_commission_total: number
  projected_commission_total: number
  has_releasable: boolean
  has_released: boolean
}

export interface ApiReleasableLine {
  referred_user_uni_id: string
  referred_name: string
  exchange: ExchangeKind
  month_year: string
  fee_paid: number
  commission: number
}

// ── Mappers (snake → camel; zero math — all figures are server-computed) ────

function mapBreakdown(b: ApiExchangeBreakdown): ExchangeBreakdown {
  return {
    exchange: b.exchange,
    paidFee: b.paid_fee,
    pendingFee: b.pending_fee,
    paidCommission: b.paid_commission,
    pendingCommission: b.pending_commission,
    releasedCommission: b.released_commission,
    unreleasedCommission: b.unreleased_commission,
    hasOverdue: b.has_overdue,
  }
}

function mapMemberBase(m: ApiReferralMember) {
  return {
    userUniId: m.user_uni_id,
    name: m.name,
    referredAt: m.referred_at,
    lastEarnings: m.last_earnings,
    lastEarningsMonth: m.last_earnings_month,
    fee: m.fee,
    yourFee: m.your_fee,
    paymentStatus: m.payment_status,
    paymentReleaseStatus: m.payment_release_status,
    breakdown: m.broker_breakdown.map(mapBreakdown),
    realizedPnl: m.realized_pnl,
    unrealizedPnl: m.unrealized_pnl,
    realizedPercentage: m.realized_percentage,
    unrealizedPercentage: m.unrealized_percentage,
  }
}

export function mapApiMember(m: ApiReferralMember): ReferralMember {
  return { ...mapMemberBase(m), status: m.status as MemberStatus }
}

export function mapApiAdminMember(m: ApiReferralMember): AdminReferralMember {
  return { ...mapMemberBase(m), status: m.status as AdminMemberStatus }
}

export function mapApiStats(s: ApiReferralStats): ReferralStats {
  return {
    totalReferrals: s.total_referrals,
    activeReferrals: s.active_referrals,
    lifetimeEarnings: s.lifetime_earnings,
    lastPayoutAt: s.last_payout_at,
    pendingPayout: s.pending_payout,
    projectedCommission: s.projected_commission,
  }
}

export function mapApiCommunity(c: ApiCommunity): CommunityDetails {
  return {
    communityName: c.community_name,
    bio: c.bio,
    profileBanner: c.profile_banner,
    profileImage: c.profile_image,
  }
}

export function mapApiPayout(p: ApiReleasedPayout): ReleasedPayout {
  return {
    id: p.id,
    monthYear: p.month_year,
    totalAmount: p.total_amount,
    payoutAddress: p.payout_address,
    txHash: p.tx_hash,
    paymentMethod: p.payment_method,
    hasProof: p.has_proof,
    paidAt: p.paid_at,
    status: p.status,
    itemsCount: p.items_count,
  }
}

export function mapApiLedgerPayout(
  p: ApiReleasedPayout & { referrer_name: string; referrer_email: string | null },
): AdminLedgerPayout {
  return {
    ...mapApiPayout(p),
    referrerUniId: p.referrer_uni_id,
    referrerName: p.referrer_name,
    referrerEmail: p.referrer_email,
  }
}

export function mapApiWallet(w: ApiCryptoWallet): CryptoWallet {
  return { id: w.id, network: w.network, address: w.address, name: w.name, isMain: w.is_main }
}

export function mapApiBank(b: ApiBankWireAccount): BankWireAccount {
  return {
    id: b.id,
    label: b.label,
    accountHolder: b.account_holder,
    bankName: b.bank_name,
    accountNumber: b.account_number,
    routingNumber: b.routing_number,
    iban: b.iban,
    swiftBic: b.swift_bic,
    accountType: b.account_type,
    bankAddress: b.bank_address,
    currency: b.currency,
    isMain: b.is_main,
  }
}

export function mapApiReferrer(r: ApiAdminReferrer): AdminReferrer {
  return {
    referralId: r.referral_id,
    code: r.code,
    userUniId: r.user_uni_id,
    referrerName: r.referrer_name,
    referrerEmail: r.referrer_email,
    affiliatePercentage: r.affiliate_percentage,
    communityName: r.community_name,
    referrals: r.referrals.map(mapApiAdminMember),
    referrerOverdue: r.referrer_overdue,
    referrerPending: r.referrer_pending,
    totalCommissionEarned: r.total_commission_earned,
    releasableCommissionTotal: r.releasable_commission_total,
    projectedCommissionTotal: r.projected_commission_total,
    hasReleasable: r.has_releasable,
    hasReleased: r.has_released,
  }
}

export function mapApiReleasableLine(l: ApiReleasableLine): ReleasableLine {
  return {
    referredUserUniId: l.referred_user_uni_id,
    referredName: l.referred_name,
    exchange: l.exchange,
    monthYear: l.month_year,
    feePaid: l.fee_paid,
    commission: l.commission,
  }
}

// ── Pure display helpers (formatting only — never commission math) ──────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** '2026-05' → 'May 2026'; null → 'Multiple months' (multi-month envelope). */
export function formatMonth(monthYear: string | null): string {
  if (!monthYear) return 'Multiple months'
  const [y, m] = monthYear.split('-')
  const idx = Number(m) - 1
  return idx >= 0 && idx < 12 ? `${MONTHS[idx]} ${y}` : monthYear
}

/** 'TAbCdEf...WxYz' — middle-elided address for tight cells. */
export function truncateAddress(address: string, head = 8, tail = 6): string {
  if (address.length <= head + tail + 1) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function tronscanTxUrl(hash: string): string {
  return `https://tronscan.org/#/transaction/${hash}`
}

/** Stable identity for a releasable line — mirrors the backend triple key. */
export function lineKey(l: ReleasableLine): string {
  return `${l.exchange}|${l.referredUserUniId}|${l.monthYear}`
}

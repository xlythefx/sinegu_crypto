import { apiFetch } from './api'
import {
  mapApiCommunity,
  mapApiMember,
  mapApiPayout,
  mapApiStats,
  type ApiCommunity,
  type ApiReferralMember,
  type ApiReferralStats,
  type ApiReleasedPayout,
} from '../lib/referrals'
import type { CommunityDetails, ReferralsData, ReleasedPayout } from '../types/referrals'

/** GET /referrals — code, community, server-computed stats, and the network. */
export async function getReferrals(): Promise<ReferralsData> {
  const res = await apiFetch<{
    success: boolean
    code: string | null
    referral_id: number | null
    affiliate_percentage: number | null
    community: ApiCommunity | null
    stats: ApiReferralStats
    referrals: ApiReferralMember[]
  }>('/referrals', { auth: true })

  return {
    code: res.code,
    referralId: res.referral_id,
    affiliatePercentage: res.affiliate_percentage,
    community: res.community ? mapApiCommunity(res.community) : null,
    stats: mapApiStats(res.stats),
    members: res.referrals.map(mapApiMember),
  }
}

/** POST /referrals/code — generate if absent; idempotent. */
export async function createReferralCode(): Promise<string> {
  const res = await apiFetch<{ success: boolean; code: string }>('/referrals/code', {
    method: 'POST',
    auth: true,
  })
  return res.code
}

/** POST /referrals/community — create or update; both fields required. */
export async function saveCommunity(
  communityName: string,
  bio: string,
): Promise<CommunityDetails> {
  const res = await apiFetch<{ success: boolean; community: ApiCommunity }>(
    '/referrals/community',
    { method: 'POST', body: { community_name: communityName, bio }, auth: true },
  )
  return mapApiCommunity(res.community)
}

/** POST /referrals/members/remove — deletes the network edge only. */
export async function removeMember(referredUserUniId: string): Promise<void> {
  await apiFetch<{ success: boolean }>('/referrals/members/remove', {
    method: 'POST',
    body: { referred_user_uni_id: referredUserUniId },
    auth: true,
  })
}

/** GET /referrals/payouts — the caller's released envelopes, newest first. */
export async function getMyPayouts(): Promise<ReleasedPayout[]> {
  const res = await apiFetch<{ success: boolean; payouts: ApiReleasedPayout[] }>(
    '/referrals/payouts',
    { auth: true },
  )
  return res.payouts.map(mapApiPayout)
}

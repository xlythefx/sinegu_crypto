import { API_URL, ApiError, apiFetch } from './api'
import { getToken } from '../lib/session'
import {
  mapApiBank,
  mapApiLedgerPayout,
  mapApiPayout,
  mapApiReferrer,
  mapApiReleasableLine,
  mapApiWallet,
  type ApiAdminReferrer,
  type ApiBankWireAccount,
  type ApiCryptoWallet,
  type ApiReleasableLine,
  type ApiReleasedPayout,
} from '../lib/referrals'
import type {
  AdminLedgerPayout,
  AdminReferrer,
  LedgerStats,
  ReleasableData,
  ReleasedPayout,
  ReleaseTriple,
} from '../types/referrals'

/** GET /admin/affiliate/overview — every referrer + nested network + flags. */
export async function getAffiliateOverview(): Promise<AdminReferrer[]> {
  const res = await apiFetch<{ success: boolean; referrers: ApiAdminReferrer[] }>(
    '/admin/affiliate/overview',
    { auth: true },
  )
  return res.referrers.map(mapApiReferrer)
}

/** GET /admin/affiliate/ledger — all envelopes, newest first. */
export async function getAffiliateLedger(): Promise<AdminLedgerPayout[]> {
  const res = await apiFetch<{
    success: boolean
    payouts: (ApiReleasedPayout & { referrer_name: string; referrer_email: string | null })[]
  }>('/admin/affiliate/ledger', { auth: true })
  return res.payouts.map(mapApiLedgerPayout)
}

/** GET /admin/affiliate/ledger-stats — count + sum of everything sent. */
export async function getLedgerStats(): Promise<LedgerStats> {
  const res = await apiFetch<{
    success: boolean
    total_sent_count: number
    total_sent_amount: number
  }>('/admin/affiliate/ledger-stats', { auth: true })
  return { totalSentCount: res.total_sent_count, totalSentAmount: res.total_sent_amount }
}

/** GET /admin/affiliate/referrers/{uni}/payouts — one referrer's envelopes (lazy sub-tab). */
export async function getReferrerPayouts(uniId: string): Promise<ReleasedPayout[]> {
  const res = await apiFetch<{ success: boolean; payouts: ApiReleasedPayout[] }>(
    `/admin/affiliate/referrers/${uniId}/payouts`,
    { auth: true },
  )
  return res.payouts.map(mapApiPayout)
}

/** GET /admin/affiliate/referrers/{uni}/releasable — feeds the release screen. */
export async function getReferrerReleasable(uniId: string): Promise<ReleasableData> {
  const res = await apiFetch<{
    success: boolean
    releasable_items: ApiReleasableLine[]
    referrer_wallets: ApiCryptoWallet[]
    bank_wire_accounts: ApiBankWireAccount[]
    referrer_name: string
    referrer_code: string | null
    affiliate_percentage: number | null
  }>(`/admin/affiliate/referrers/${uniId}/releasable`, { auth: true })

  return {
    items: res.releasable_items.map(mapApiReleasableLine),
    wallets: res.referrer_wallets.map(mapApiWallet),
    bankAccounts: res.bank_wire_accounts.map(mapApiBank),
    referrerName: res.referrer_name,
    referrerCode: res.referrer_code,
    affiliatePercentage: res.affiliate_percentage,
  }
}

/** POST /admin/affiliate/release — crypto path (JSON, tx_hash required). */
export async function releaseCrypto(params: {
  referrerUniId: string
  items: ReleaseTriple[]
  payoutAddress: string
  txHash: string
}): Promise<void> {
  await apiFetch<{ success: boolean }>('/admin/affiliate/release', {
    method: 'POST',
    auth: true,
    body: {
      referrer_uni_id: params.referrerUniId,
      payment_method: 'crypto',
      payout_address: params.payoutAddress,
      tx_hash: params.txHash,
      items: params.items,
    },
  })
}

/**
 * POST /admin/affiliate/release — bank-wire path (multipart with proof file).
 * Raw fetch + FormData: apiFetch only speaks JSON. Items travel as a JSON
 * string; the backend normalizes both encodings into one code path.
 */
export async function releaseBankWire(params: {
  referrerUniId: string
  items: ReleaseTriple[]
  payoutAddress: string
  proofFile: File
}): Promise<void> {
  const form = new FormData()
  form.append('referrer_uni_id', params.referrerUniId)
  form.append('payment_method', 'bank_wire')
  form.append('payout_address', params.payoutAddress)
  form.append('items', JSON.stringify(params.items))
  form.append('proof_file', params.proofFile)

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_URL}/admin/affiliate/release`, {
      method: 'POST',
      headers,
      body: form,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the API running?')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.message ?? `Request failed (${res.status})`,
      data.error_code,
      data.errors,
    )
  }
}

/** DELETE /admin/affiliate/payouts/{id} — the Undo; lines become releasable again. */
export async function undoPayout(id: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/affiliate/payouts/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}

/**
 * GET /admin/affiliate/payouts/{id}/proof — authorized download from the
 * private disk. Returns a Blob; caller opens it via URL.createObjectURL.
 */
export async function fetchProofBlob(id: number): Promise<Blob> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_URL}/admin/affiliate/payouts/${id}/proof`, { headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the API running?')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, data.message ?? 'Proof not found.', data.error_code)
  }

  return res.blob()
}

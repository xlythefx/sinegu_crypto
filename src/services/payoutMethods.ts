import { apiFetch } from './api'
import {
  mapApiBank,
  mapApiWallet,
  type ApiBankWireAccount,
  type ApiCryptoWallet,
} from '../lib/referrals'
import type { BankWireAccount, CryptoWallet } from '../types/referrals'

export interface WalletInput {
  network: string
  address: string
  name: string
}

export interface BankInput {
  label: string
  accountHolder?: string
  bankName?: string
  accountNumber?: string
  routingNumber?: string
  iban?: string
  swiftBic?: string
  accountType?: string
  bankAddress?: string
  currency?: string
}

function bankBody(input: BankInput) {
  return {
    label: input.label,
    account_holder: input.accountHolder ?? null,
    bank_name: input.bankName ?? null,
    account_number: input.accountNumber ?? null,
    routing_number: input.routingNumber ?? null,
    iban: input.iban ?? null,
    swift_bic: input.swiftBic ?? null,
    account_type: input.accountType ?? null,
    bank_address: input.bankAddress ?? null,
    currency: input.currency ?? 'USD',
  }
}

/** GET /payout-methods — wallets + bank accounts, main first. */
export async function getPayoutMethods(): Promise<{
  wallets: CryptoWallet[]
  bankAccounts: BankWireAccount[]
}> {
  const res = await apiFetch<{
    success: boolean
    wallets: ApiCryptoWallet[]
    bank_accounts: ApiBankWireAccount[]
  }>('/payout-methods', { auth: true })
  return {
    wallets: res.wallets.map(mapApiWallet),
    bankAccounts: res.bank_accounts.map(mapApiBank),
  }
}

export async function addWallet(input: WalletInput): Promise<CryptoWallet> {
  const res = await apiFetch<{ success: boolean; wallet: ApiCryptoWallet }>(
    '/payout-methods/wallets',
    { method: 'POST', body: input, auth: true },
  )
  return mapApiWallet(res.wallet)
}

export async function updateWallet(id: number, input: WalletInput): Promise<CryptoWallet> {
  const res = await apiFetch<{ success: boolean; wallet: ApiCryptoWallet }>(
    `/payout-methods/wallets/${id}`,
    { method: 'PUT', body: input, auth: true },
  )
  return mapApiWallet(res.wallet)
}

export async function deleteWallet(id: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/payout-methods/wallets/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}

export async function addBank(input: BankInput): Promise<BankWireAccount> {
  const res = await apiFetch<{ success: boolean; bank_account: ApiBankWireAccount }>(
    '/payout-methods/banks',
    { method: 'POST', body: bankBody(input), auth: true },
  )
  return mapApiBank(res.bank_account)
}

export async function updateBank(id: number, input: BankInput): Promise<BankWireAccount> {
  const res = await apiFetch<{ success: boolean; bank_account: ApiBankWireAccount }>(
    `/payout-methods/banks/${id}`,
    { method: 'PUT', body: bankBody(input), auth: true },
  )
  return mapApiBank(res.bank_account)
}

export async function deleteBank(id: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/payout-methods/banks/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}

/** POST /payout-methods/set-main — one main per type; clears siblings. */
export async function setMainPayoutMethod(type: 'wallet' | 'bank', id: number): Promise<void> {
  await apiFetch<{ success: boolean }>('/payout-methods/set-main', {
    method: 'POST',
    body: { type, id },
    auth: true,
  })
}

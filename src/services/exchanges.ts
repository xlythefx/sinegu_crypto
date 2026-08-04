import { apiFetch } from './api'
import type { ExchangeAccount } from '../types/exchanges'

export async function getExchangeAccounts(): Promise<ExchangeAccount[]> {
  const res = await apiFetch<{ success: boolean; accounts: ExchangeAccount[] }>(
    '/exchange/accounts',
    { auth: true },
  )
  return res.accounts
}

export interface ConnectBinancePayload {
  name: string
  api_key: string
  secret_key: string
}

export async function connectBinanceAccount(
  payload: ConnectBinancePayload,
): Promise<ExchangeAccount> {
  const res = await apiFetch<{ success: boolean; account: ExchangeAccount }>(
    '/exchange/binance',
    { method: 'POST', body: payload, auth: true },
  )
  return res.account
}

/** Rename an account — display label only, does not touch its API keys. */
export async function renameExchangeAccount(
  id: number,
  name: string,
): Promise<ExchangeAccount> {
  const res = await apiFetch<{ success: boolean; account: ExchangeAccount }>(
    `/exchange/accounts/${id}`,
    { method: 'PUT', body: { name }, auth: true },
  )
  return res.account
}

export async function deleteExchangeAccount(id: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/exchange/accounts/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}

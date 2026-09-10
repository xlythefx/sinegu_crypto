import { apiFetch } from './api'
import type { ExchangeAccount } from '../types/exchanges'

export async function getExchangeAccounts(): Promise<ExchangeAccount[]> {
  const res = await apiFetch<{ success: boolean; accounts: ExchangeAccount[] }>(
    '/exchange/accounts',
    { auth: true },
  )
  return res.accounts
}

export interface ExchangeAccountsPayload {
  accounts: ExchangeAccount[]
  /** The address a user must allow-list on their API key. */
  serverIp: string | null
}

/** Same as {@link getExchangeAccounts} but keeps the server IP alongside. */
export async function getExchangeAccountsWithMeta(): Promise<ExchangeAccountsPayload> {
  const res = await apiFetch<{
    success: boolean
    accounts: ExchangeAccount[]
    server_ip?: string | null
  }>('/exchange/accounts', { auth: true })

  return { accounts: res.accounts, serverIp: res.server_ip ?? null }
}

/** Accounts the exchange is currently refusing — the ones needing a fix. */
export function blockedAccounts(accounts: ExchangeAccount[]): ExchangeAccount[] {
  return accounts.filter((a) => a.key_status === 'blocked')
}

export interface ConnectBinancePayload {
  name: string
  api_key: string
  secret_key: string
  /**
   * true routes this account to the Binance futures TESTNET, false to real
   * mainnet trading. The keys differ per network — a testnet key is issued by
   * testnet.binancefuture.com and is rejected on mainnet — so the wizard makes
   * the user choose rather than inferring it.
   */
  demo: boolean
}

export async function connectBinanceAccount(
  payload: ConnectBinancePayload,
): Promise<ConnectBinanceResult> {
  const res = await apiFetch<{
    success: boolean
    account: ExchangeAccount
    reconnected?: boolean
  }>('/exchange/binance', { method: 'POST', body: payload, auth: true })

  return { account: res.account, reconnected: Boolean(res.reconnected) }
}

/**
 * `reconnected` means the API revived a key this user had disconnected before,
 * rather than creating a new account — so its trade history and billing
 * baseline came back with it, and the success screen says so.
 */
export interface ConnectBinanceResult {
  account: ExchangeAccount
  reconnected: boolean
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

export interface BalanceRefreshResult {
  account: ExchangeAccount
  /** Seconds until this account may be refreshed again. */
  retryAfter: number
}

/**
 * Pull one account's balance from the exchange now rather than at the poller's
 * next tick. The server enforces a 60s per-account cooldown and answers 429
 * with `retry_after` — the button's countdown is a courtesy, not the limit.
 */
export async function refreshAccountBalance(
  id: number,
): Promise<BalanceRefreshResult> {
  const res = await apiFetch<{
    success: boolean
    account: ExchangeAccount
    retry_after: number
  }>(`/exchange/accounts/${id}/refresh-balance`, { method: 'POST', auth: true })

  return { account: res.account, retryAfter: res.retry_after ?? 60 }
}

export async function deleteExchangeAccount(id: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/exchange/accounts/${id}`, {
    method: 'DELETE',
    auth: true,
  })
}

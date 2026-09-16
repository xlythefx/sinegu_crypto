import { apiFetch } from './api'
import type { ExchangeAccount, ExchangeKind } from '../types/exchanges'
import { exchangeOf } from '../components/exchanges/meta'

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

export interface ConnectExchangePayload {
  name: string
  api_key: string
  secret_key: string
  /**
   * true routes this account to the exchange's futures TESTNET, false to real
   * mainnet trading. The keys differ per network — a Binance testnet key is
   * issued by testnet.binancefuture.com and is rejected on mainnet — so the
   * wizard makes the user choose rather than inferring it. Venues without a
   * testnet (MEXC) refuse `true` outright.
   */
  demo: boolean
}

/** @deprecated name kept for older imports — same shape. */
export type ConnectBinancePayload = ConnectExchangePayload

/**
 * `reconnected` means the API revived a key this user had disconnected before,
 * rather than creating a new account — so its trade history and billing
 * baseline came back with it, and the success screen says so.
 */
export interface ConnectExchangeResult {
  account: ExchangeAccount
  reconnected: boolean
}

/** @deprecated name kept for older imports — same shape. */
export type ConnectBinanceResult = ConnectExchangeResult

/**
 * Connect an account on one exchange — POST /exchange/{kind}. Every account
 * lives in that exchange's own table, and the row that comes back carries
 * `exchange` so later calls can be routed by it.
 */
export async function connectExchangeAccount(
  kind: ExchangeKind,
  payload: ConnectExchangePayload,
): Promise<ConnectExchangeResult> {
  const res = await apiFetch<{
    success: boolean
    account: ExchangeAccount
    reconnected?: boolean
  }>(`/exchange/${kind}`, { method: 'POST', body: payload, auth: true })

  return { account: res.account, reconnected: Boolean(res.reconnected) }
}

/** @deprecated use {@link connectExchangeAccount}('binance', …). */
export function connectBinanceAccount(
  payload: ConnectExchangePayload,
): Promise<ConnectExchangeResult> {
  return connectExchangeAccount('binance', payload)
}

/** An account is addressed by (exchange, id) — ids repeat across the per-exchange tables. */
type AccountRef = Pick<ExchangeAccount, 'id'> & { exchange?: ExchangeKind | null }

function accountPath(account: AccountRef): string {
  return `/exchange/${exchangeOf(account)}/accounts/${account.id}`
}

/** Rename an account — display label only, does not touch its API keys. */
export async function renameExchangeAccount(
  account: AccountRef,
  name: string,
): Promise<ExchangeAccount> {
  const res = await apiFetch<{ success: boolean; account: ExchangeAccount }>(
    accountPath(account),
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
  account: AccountRef,
): Promise<BalanceRefreshResult> {
  const res = await apiFetch<{
    success: boolean
    account: ExchangeAccount
    retry_after: number
  }>(`${accountPath(account)}/refresh-balance`, { method: 'POST', auth: true })

  return { account: res.account, retryAfter: res.retry_after ?? 60 }
}

export async function deleteExchangeAccount(account: AccountRef): Promise<void> {
  await apiFetch<{ success: boolean }>(accountPath(account), {
    method: 'DELETE',
    auth: true,
  })
}

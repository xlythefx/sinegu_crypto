import type { ExchangeKind } from '../../types/exchanges'

/**
 * Everything the connect wizard, the account card and the "key blocked" modal
 * say that differs per exchange — where keys are created, what the permission
 * and the IP setting are called on that site, what the venue's own key rules
 * are. Kept as data so a new venue is one entry here, not a fork of the steps.
 */
export interface ExchangeCopy {
  /** Sentence fragment: "Trades your real {marketName} balance." */
  marketName: string
  /** The page where a live key is created. */
  liveKeysUrl: string
  liveKeysLabel: string
  /** Numbered instructions for a live key, in the order the site presents them. */
  liveSteps: string[]
  /** Testnet counterparts — only for venues with `hasTestnet`. */
  demoSite?: string
  demoKeysUrl?: string
  demoKeysLabel?: string
  demoSteps?: string[]
  /** The mode step's one-line answer to "where do demo keys come from". */
  demoKeysPoint?: string
  /** What the venue calls its IP allow-list setting (quoted to the user). */
  ipSettingName: string
  /** What the venue calls the futures trading permission. */
  permissionName: string
  /** Under the secret field. */
  secretHint: string
  /** One venue-specific rule worth stating beside the fields, if any. */
  keyNote?: string
  /** `key_error_reason` values that mean the KEY itself is dead (not an IP fix). */
  deadKeyReasons: string[]
  /** Shown in the blocked-key modal for a dead key. */
  deadKeyExplanation: string
  /**
   * `key_error_reason` values that mean the key READS but may not TRADE — the
   * venue accepts it for balances and positions and refuses every order. It is
   * the hardest fault to self-diagnose, because nothing about the account looks
   * broken, so it gets its own wording rather than the IP one.
   */
  tradePermissionReasons: string[]
  /** What the modal says for each fault it can name. */
  blocked: {
    ip: BlockedCopy
    tradePermission: BlockedCopy
  }
}

export interface BlockedCopy {
  /** Leads the modal: what the exchange is doing and why nothing looks wrong. */
  explanation: string
  /** Numbered, in the order the site presents them. */
  steps: string[]
}

export const EXCHANGE_COPY: Record<ExchangeKind, ExchangeCopy> = {
  binance: {
    marketName: 'Binance futures',
    liveKeysUrl: 'https://www.binance.com/en/my/settings/api-management',
    liveKeysLabel: 'Open Binance API Management',
    liveSteps: [
      'Open Binance → API Management and create a new API key.',
      'Enable Futures. Leave withdrawals OFF — we never need them, and a key that cannot withdraw cannot lose you funds.',
      'If you restrict the key by IP, add our server address below. A key locked to your own IP looks connected here but silently takes no trades.',
      'Copy the API key and secret key into the fields below.',
    ],
    demoSite: 'testnet.binancefuture.com',
    demoKeysUrl: 'https://testnet.binancefuture.com',
    demoKeysLabel: 'Open Binance testnet',
    demoKeysPoint: 'Keys from testnet.binancefuture.com (a separate login)',
    demoSteps: [
      'Open testnet.binancefuture.com and sign in — it is a separate account from binance.com.',
      'Open API Key from the account menu and copy the testnet key pair.',
      'Testnet balances are play money, topped up from the faucet on that site.',
      'Paste the testnet API key and secret key below.',
    ],
    ipSettingName: 'Restrict access to trusted IPs',
    permissionName: 'Enable Futures',
    secretHint:
      'Binance shows the secret once, at creation. If you lost it, create a new key rather than guessing.',
    deadKeyReasons: ['BAD_KEY_FORMAT', 'UNKNOWN_KEY', 'BAD_SIGNATURE'],
    deadKeyExplanation:
      'The key itself is not valid any more — it may have been deleted or regenerated on Binance. Disconnect this account and connect a fresh trade-only key.',
    tradePermissionReasons: ['TRADE_PERMISSION'],
    blocked: {
      ip: {
        explanation:
          'Your API key is restricted to specific IP addresses, and ours is not on the list. Binance refuses everything we send with it, which is why the account says connected while the balance sits still.',
        steps: [
          'Open Binance → API Management and edit this key.',
          'Paste the address above under “Restrict access to trusted IPs” and save.',
          'Check that “Enable Futures” is still ticked — the key must be able to trade, never to withdraw.',
          'Come back and press “I’ve fixed it — recheck”.',
        ],
      },
      tradePermission: {
        explanation:
          'This key works — we can read your balance with it — but Binance does not allow it to trade. Futures was never enabled on the key, so every order is refused while the account looks perfectly connected.',
        steps: [
          'Open Binance → API Management and edit this key.',
          'Paste the address above under “Restrict access to trusted IPs” and save — Binance only allows futures trading on a key that is restricted to trusted IPs.',
          'Tick “Enable Futures” and save. Leave withdrawals OFF — we never need them.',
          'Come back and press “I’ve fixed it — recheck”. We ask Binance what the key is allowed to do, so you will know straight away.',
        ],
      },
    },
  },
  bybit: {
    marketName: 'Bybit futures',
    liveKeysUrl: 'https://www.bybit.com/app/user/api-management',
    liveKeysLabel: 'Open Bybit API Management',
    liveSteps: [],
    ipSettingName: 'IP restriction',
    permissionName: 'Contract — Orders & Positions',
    secretHint: 'Bybit shows the secret once, at creation.',
    deadKeyReasons: [],
    deadKeyExplanation: '',
    tradePermissionReasons: [],
    blocked: {
      ip: { explanation: '', steps: [] },
      tradePermission: { explanation: '', steps: [] },
    },
  },
  mexc: {
    marketName: 'MEXC futures',
    liveKeysUrl: 'https://www.mexc.com/user/openapi',
    liveKeysLabel: 'Open MEXC API Management',
    liveSteps: [
      'Open MEXC → Account → API Management and create a new API key.',
      'Under Futures, tick Trade (and Read). Leave Withdraw and Transfer OFF — we never need them.',
      'Bind our server address below under “Link IP address”. A MEXC key with no IP bound expires after 90 days; a key bound only to your own IP looks connected here but silently takes no trades.',
      'Copy the Access Key and Secret Key into the fields below.',
    ],
    demoSite: 'futures.testnet.mexc.com',
    demoKeysUrl: 'https://www.mexc.com/user/openapi',
    demoKeysLabel: 'Open MEXC API Management',
    demoKeysPoint: 'Same MEXC login and keys — a key with no IP binding',
    demoSteps: [
      'Open futures.testnet.mexc.com and sign in with your normal MEXC account — the testnet holds 10,000 test USDT, separate from your real balance.',
      'The keys are the same as live: create one on mexc.com → API Management with Futures Trade permission — but leave “Link IP address” EMPTY. The testnet sits behind a CDN and refuses any IP-bound key.',
      'An unbound key expires after 90 days, which is fine for a demo. Treat it as a live key all the same: it is valid on your real account too — the bot only ever sends a demo account’s orders to the testnet.',
      'Paste the Access Key and Secret Key below.',
    ],
    ipSettingName: 'Link IP address',
    permissionName: 'Futures — Trade',
    secretHint:
      'MEXC shows the Secret Key once, at creation. If you lost it, create a new key rather than guessing.',
    keyNote:
      'MEXC only lets KYC-verified accounts trade futures through the API — finish verification on MEXC first, or every order is refused.',
    deadKeyReasons: ['KEY_EXPIRED', 'NOT_LOGGED_IN', 'BAD_SIGNATURE'],
    deadKeyExplanation:
      'The key itself no longer works — MEXC keys without an IP binding expire after 90 days, and a deleted or regenerated key stops the same way. Disconnect this account and connect a fresh key, bound to our server address so it does not expire.',
    tradePermissionReasons: [
      'PERMISSION_READ',
      'PERMISSION_WRITE',
      'PERMISSION_TRADE_READ',
      'PERMISSION_TRADE_WRITE',
    ],
    blocked: {
      ip: {
        explanation:
          'Your API key is bound to specific IP addresses, and ours is not one of them. MEXC refuses everything we send with it, which is why the account says connected while the balance sits still.',
        steps: [
          'Open MEXC → Account → API Management and edit this key.',
          'Paste the address above under “Link IP address” and save.',
          'Check that Futures → Trade is still ticked — the key must be able to trade, never to withdraw.',
          'Come back and press “I’ve fixed it — recheck”.',
        ],
      },
      tradePermission: {
        explanation:
          'MEXC accepts this key but will not let it trade: the Futures permission it needs is not on it. Every order is refused while the account looks perfectly connected.',
        steps: [
          'Open MEXC → Account → API Management and edit this key.',
          'Under Futures, tick Trade and Read. Leave Withdraw and Transfer OFF — we never need them.',
          'Paste the address above under “Link IP address” and save. A key with no IP bound also expires after 90 days.',
          'Finish KYC on MEXC if you have not — MEXC only lets verified accounts trade futures through the API.',
          'Come back and press “I’ve fixed it — recheck”.',
        ],
      },
    },
  },
}

/** Whether a `key_error_reason` means "replace the key" rather than "fix the IP list". */
export function isDeadKey(kind: ExchangeKind, reason: string | null | undefined): boolean {
  return Boolean(reason) && EXCHANGE_COPY[kind].deadKeyReasons.includes(reason as string)
}

/**
 * Which of the three faults an account is in, from the reason the engine
 * reported. `ip` is the fallback because it is what an unnamed credential
 * refusal has always meant, and its instructions (add our address, check the
 * trading permission) cover the permission case too.
 */
export type KeyFault = 'dead' | 'tradePermission' | 'ip'

export function keyFault(kind: ExchangeKind, reason: string | null | undefined): KeyFault {
  if (isDeadKey(kind, reason)) return 'dead'
  if (reason && EXCHANGE_COPY[kind].tradePermissionReasons.includes(reason)) {
    return 'tradePermission'
  }
  return 'ip'
}

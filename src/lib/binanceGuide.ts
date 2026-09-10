/**
 * Content for the public Binance connection guide (`/docs/binance`).
 *
 * Data, not JSX, for the same reason the legal documents are: the wording
 * follows Binance's own screens, and Binance renames things. When a screenshot
 * goes stale, this file and the PNG in `public/binance-guide/` change — the
 * page component does not.
 *
 * `**bold**` inside a body string is rendered as emphasis; nothing else is
 * parsed.
 */
export interface GuideStep {
  number: number
  title: string
  /** One paragraph per entry. */
  body: string[]
  image: string
  /** Rendered as a copyable mono block under the paragraphs. */
  ip?: boolean
  /** Amber callout under the paragraphs — the mistakes that cost people money. */
  warning?: string
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    number: 1,
    title: 'Open Account → API Management',
    body: [
      'Log in to your account at **binance.com**. Open the profile menu in the top-right corner, choose **Account**, then open **API Management** from the account menu.',
      'This is the page where Binance creates and manages the keys that let an outside application — Pixel Alpha, in this case — trade on your behalf. Nothing you do here moves any funds.',
    ],
    image: '/binance-guide/first.png',
  },
  {
    number: 2,
    title: 'Create a new API key',
    body: [
      'Click **Create API**. Give the key a label you will recognise later — **Pixel Alpha** is the obvious one, and a named key is far easier to revoke confidently a year from now.',
      'Binance will ask you to confirm with your usual security checks (email code, SMS, or authenticator) before it creates the key.',
    ],
    image: '/binance-guide/newsecond.png',
  },
  {
    number: 3,
    title: 'Choose HMAC as the signature type',
    body: [
      'Binance offers several signature types. Select **HMAC** — the **System generated** option — and continue.',
      'This is the signing method our engine uses. A key created as Ed25519 or with a self-supplied RSA key cannot be used to trade your account through Pixel Alpha, and there is no way to convert one afterwards: you would have to create a new key.',
    ],
    image: '/binance-guide/third.png',
    warning:
      'If you pick the wrong signature type here, the key will be rejected the moment we try to use it. Create a fresh HMAC key rather than trying to fix the old one.',
  },
  {
    number: 4,
    title: 'Set permissions and allow-list our IP',
    body: [
      'In the key’s edit screen, enable **Enable Futures** — that is the permission the bot needs to open and close positions.',
      'Leave **Enable Withdrawals** switched OFF. We never need it, and a key that cannot withdraw cannot lose you funds no matter who holds it. Any service that asks you to enable withdrawals should be refused, ours included.',
      'If you tick **Restrict access to trusted IPs only** — recommended — you must add our server address to the list, otherwise Binance will refuse every request we make and your account will look connected while silently taking no trades.',
      'Save the key. Binance shows the **secret key exactly once**, at creation. Copy both the API key and the secret now; if you lose the secret, you create a new key rather than recovering the old one.',
    ],
    image: '/binance-guide/fourth.png',
    ip: true,
    warning:
      'This is the step that goes wrong most often. A key restricted to your own home IP address, with ours missing, produces no error you would notice — the account reads "connected", the balance freezes, and no trades arrive.',
  },
  {
    number: 5,
    title: 'Fund your USD-M Futures wallet',
    body: [
      'The bot trades USD-M futures, so your capital has to be in the futures wallet — funds sitting in the Spot wallet cannot be traded and will not be seen.',
      'In Binance, go to **Wallet → Spot**, click **Transfer**, and move **USDT** from **Spot Wallet** to **USDT-M Futures**. The transfer is internal to your own account and is instant.',
    ],
    image: '/binance-guide/fifth.png',
  },
]

/**
 * Minimum deposited capital before the engine will open a position. Must match
 * `BINANCE_ABCD_MIN_DEPOSIT` in the engine — a page promising a lower figure
 * produces a customer whose bot silently never trades.
 */
export const MIN_DEPOSIT_USDT = '1,000'

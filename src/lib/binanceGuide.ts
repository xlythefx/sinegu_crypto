/**
 * Content for the public Binance connection guide (`/docs/binance`).
 *
 * Data, not JSX, for the same reason the legal documents are: the wording
 * follows Binance's own screens, and Binance renames things. When a screenshot
 * goes stale, this file and the PNG in `public/binance-guide/` change — the
 * page component does not.
 *
 * `**bold**` inside any string is rendered as emphasis; nothing else is
 * parsed. Bold is reserved for the words the reader will see on Binance's
 * screen (button and menu names), so they can match them at a glance.
 */
export interface GuideStep {
  /**
   * Stable slug — the reader's ticked-off state is saved under it, so it is
   * never renamed once shipped (a rename silently un-ticks the step).
   */
  id: string
  title: string
  /** One or two plain sentences: what this step achieves and why. */
  summary: string
  /** The clicks, in order. Rendered as a numbered list. */
  actions: string[]
  /** Screenshots, in the order the actions reach them. */
  images?: string[]
  /** Rendered as a copyable mono block under the actions. */
  ip?: boolean
  /** Amber callout — the mistakes that cost people money or time. */
  warning?: string
  /** Quiet reassurance under the actions. */
  tip?: string
  /** A button that opens the right screen; `to` is an in-app route. */
  link?: { label: string; href?: string; to?: string }
}

/**
 * Minimum deposited capital before the engine will open a position. Must match
 * `BINANCE_ABCD_MIN_DEPOSIT` in the engine — a page promising a lower figure
 * produces a customer whose bot silently never trades.
 */
export const MIN_DEPOSIT_USDT = '1,000'

export const API_MANAGEMENT_URL = 'https://www.binance.com/en/my/settings/api-management'

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'open-futures',
    title: 'Turn on Futures on your Binance account',
    summary:
      'Do this before anything else. Binance only lets an API key trade futures if your Futures account was already open when the key was created.',
    actions: [
      'Log in to **binance.com** (or the Binance app).',
      'In the top menu, open **Futures → USDⓈ-M Futures**. On the app, tap the **Futures** tab.',
      'Press **Open Now** (sometimes called **Open Futures Account**) and answer Binance’s short futures quiz.',
      'When you can see the futures trading screen, your Futures account is open.',
    ],
    warning:
      'Made an API key before opening Futures? Its **Enable Futures** box will be greyed out or will not save. Delete that key and make a new one after this step.',
    link: { label: 'Open Binance Futures', href: 'https://www.binance.com/en/futures/BTCUSDT' },
  },
  {
    id: 'move-funds',
    title: 'Move USDT from Spot to Futures',
    summary:
      'The bot only trades the money in your USDⓈ-M Futures wallet. Anything left in Spot is invisible to it.',
    actions: [
      'Go to **Wallet → Overview** (on the app: **Assets**) and press **Transfer**.',
      'Set **From: Fiat and Spot** and **To: USDⓈ-M Futures**.',
      `Pick **USDT**, type the amount — at least **${MIN_DEPOSIT_USDT} USDT** — and press **Confirm**.`,
    ],
    tip: 'This is a move between two wallets inside your own Binance account. It is instant and free, and the money never leaves Binance.',
    images: ['/binance-guide/fifth.png'],
  },
  {
    id: 'api-management',
    title: 'Open API Management',
    summary:
      'This is the page where Binance makes the key that lets Pixel Alpha place trades for you. Nothing here moves your money.',
    actions: [
      'Click your **profile icon** in the top-right corner.',
      'Choose **Account → API Management**. On the app, search for **API Management**.',
    ],
    images: ['/binance-guide/first.png'],
    link: { label: 'Open API Management', href: API_MANAGEMENT_URL },
  },
  {
    id: 'create-key',
    title: 'Create a “System generated” key',
    summary: 'Binance offers two kinds of key. Pixel Alpha works with the first one only.',
    actions: [
      'Press **Create API**.',
      'Choose **System generated** and press **Next**.',
    ],
    warning:
      'Do not pick **Self-generated** (Ed25519 / RSA). Pixel Alpha cannot use those keys, and a key’s type can never be changed — you would have to start again.',
    images: ['/binance-guide/newsecond.png', '/binance-guide/third.png'],
  },
  {
    id: 'name-key',
    title: 'Name the key “Pixel Alpha”',
    summary:
      'The name is just a label for you — it makes the key easy to find if you ever want to switch it off.',
    actions: [
      'Under **Label API Key to proceed**, type **Pixel Alpha**.',
      'Press **Next**.',
      'Finish Binance’s security check (email code, SMS or authenticator app). Your new key now appears in the list.',
    ],
    images: ['/binance-guide/label.png'],
  },
  {
    id: 'permissions',
    title: 'Lock the key to our server and allow Futures',
    summary:
      'The step that matters most. Follow it in this order — Binance only allows futures trading once the key is locked to an IP address.',
    actions: [
      'Next to your **Pixel Alpha** key, press **Edit restrictions**.',
      'Under **IP access restrictions**, choose **Restrict access to trusted IPs only**.',
      'Paste our server IP (below) into the box and press **Confirm**.',
      'Tick **Enable Futures**. Leave **Enable Reading** ticked.',
      'Leave every other box **unticked** — above all **Enable Withdrawals**.',
      'Press **Save** and finish the security check.',
    ],
    ip: true,
    warning:
      'Binance deletes any key that can trade without an IP restriction. And a key locked to YOUR IP instead of ours looks connected in Pixel Alpha but never places a trade.',
    tip: 'With withdrawals off, the key can open and close trades — nothing else. No one holding it can take money out of your account, including us.',
    images: ['/binance-guide/fourth.png'],
  },
  {
    id: 'copy-keys',
    title: 'Copy your API Key and Secret Key',
    summary: 'You need both for the last step.',
    actions: [
      'Copy the **API Key**.',
      'Copy the **Secret Key**. Binance shows it **only once**, right after the key is created.',
      'Keep them somewhere private until the next step. Never send them by chat or email — not even to us.',
    ],
    warning:
      'Lost the Secret Key? It cannot be shown again. Delete the key and repeat steps 4–7 to make a new one.',
  },
  {
    id: 'connect',
    title: 'Paste them into Pixel Alpha',
    summary: 'Last step — this is where the bot gets connected.',
    actions: [
      'In your Pixel Alpha dashboard, open **Exchange Accounts → Connect exchange**.',
      'Choose **Binance**, then **Live account**.',
      'Paste the API Key and Secret Key, check the summary, and press **Connect**.',
    ],
    tip: `Once connected, the bot trades your futures balance on the next signal — as long as at least ${MIN_DEPOSIT_USDT} USDT is in your Futures wallet.`,
    link: { label: 'Connect Binance', to: '/dashboard/exchanges/connect' },
  },
]

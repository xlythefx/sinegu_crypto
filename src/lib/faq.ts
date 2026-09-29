/**
 * Public FAQ content. Same rule as the legal files: every answer describes
 * what the product actually does today — the deposit gate, the HWM, the
 * blocked-key grace period are engine and API rules, not marketing copy. If
 * a rule changes, the answer changes with it.
 */
export interface FaqEntry {
  q: string
  a: string
}

export interface FaqGroup {
  id: string
  title: string
  entries: FaqEntry[]
}

export const FAQ: FaqGroup[] = [
  {
    id: 'basics',
    title: 'The basics',
    entries: [
      {
        q: 'What is Pixel Alpha?',
        a: 'An automated trading service. Our strategy sends buy, sell and exit signals; a trading engine executes each one on every connected customer account through the exchange\'s API. You keep your account, your funds and your exchange login — we only get a trade-only API key.',
      },
      {
        q: 'Which exchanges can I use?',
        a: 'Binance, for now. Bybit and MEXC are coming soon.',
      },
      {
        q: 'Do you hold my money?',
        a: 'No. Your funds stay in your own exchange account at all times. The API key you give us can place and close futures trades and read your balance; it cannot withdraw. We never ask for a key with withdrawal permission, and you should never create one.',
      },
      {
        q: 'Can I try it without real money first?',
        a: 'On Binance, yes: connect a key from the Binance Futures Testnet and choose "Demo" in the connect wizard. The engine then trades play money on the testnet with the same signals.',
      },
      {
        q: 'Is there a minimum?',
        a: 'The engine opens new positions on an account once it has been funded with at least 1,000 USDT (deposits into the futures wallet, net of withdrawals). Below that, the account stays connected and receives no entries. The figure is deposits, not balance — an account funded above the minimum keeps trading through a drawdown.',
      },
    ],
  },
  {
    id: 'fees',
    title: 'Fees and billing',
    entries: [
      {
        q: 'What does it cost?',
        a: '20% of the profit we make for you — nothing else. Nothing to connect, nothing per month, and no profit means no invoice.',
      },
      {
        q: 'What is the high-water mark?',
        a: 'The highest level your account has reached at a previous month end. You are only billed on profit ABOVE it, so after a losing month you pay nothing until the account has made the loss back and gone higher. You never pay twice for the same gain.',
      },
      {
        q: 'How do I pay?',
        a: 'Invoices appear under Billing & Invoices in the dashboard. You pay them in USDT on the TRON network (TRC-20): send the exact amount shown to our wallet, and the invoice is marked paid automatically once the transfer lands. Card payments are not available yet.',
      },
      {
        q: 'What happens if I don\'t pay?',
        a: 'Once an invoice is past its due date, the bot stops opening new trades on your account. Positions already open are still closed normally. As soon as you pay, trading turns back on by itself — no need to contact support. While trading is paused your account cannot make profit, so we suggest paying every invoice on time.',
      },
      {
        q: 'Does the exchange charge fees too?',
        a: 'Yes. The exchange takes its own trading commission and funding payments on every trade, regardless of outcome. Those go to the exchange, not to us. To keep it fair, our 20% is taken on your profit AFTER exchange fees, never before. Your dashboard shows profit both before and after them.',
      },
    ],
  },
  {
    id: 'setup',
    title: 'Connecting an account',
    entries: [
      {
        q: 'What permissions does the API key need?',
        a: 'Read and futures trading. Nothing else — no withdrawals, no transfers. Our step-by-step guide shows exactly which boxes to tick on each exchange.',
      },
      {
        q: 'Should I restrict the key to an IP address?',
        a: 'Yes, to OUR server\'s IP, which the connect wizard shows you. Restricting the key to your own IP is the most common setup mistake: the account looks connected, but every call from our server is refused and no trades arrive. If that happens the dashboard flags the key and shows the IP to allow-list.',
      },
      {
        q: 'What if my key gets flagged?',
        a: 'Fix the key\'s settings at the exchange (usually the IP restriction), then press Recheck. Any successful call clears the flag. A key that stays refused for 3 days is disconnected automatically so you can connect a fresh one.',
      },
      {
        q: 'Can I trade manually on the same account?',
        a: 'We strongly advise against it. The engine sizes and stacks positions from what it reads on the account; a manual trade or a manual close changes that picture and later signals act on it. Use a separate sub-account for anything you trade yourself.',
      },
      {
        q: 'How do I stop?',
        a: 'Disconnect the account from Exchange Accounts — trading on that key stops immediately. Close any open position yourself on the exchange first if you do not want the strategy\'s exit to handle it. You can also delete the key at the exchange, which cuts our access regardless.',
      },
    ],
  },
  {
    id: 'trading',
    title: 'How the trading works',
    entries: [
      {
        q: 'How are positions sized?',
        a: 'Each asset has a base size. An account with the reference balance trades that size; larger accounts trade proportionally more, smaller ones trade exactly the base size. The same signal therefore opens a larger position on a larger account, and the same cap on stacked entries applies to everyone.',
      },
      {
        q: 'Why did a signal skip my account?',
        a: 'The usual reasons: the account is below the deposit minimum, the position for that symbol is already at its maximum stack, the balance cannot cover the size, the key is flagged, or an invoice is past due. Every processed signal is logged with the reason per account, so support can tell you exactly which.',
      },
      {
        q: 'Where can I see the strategy\'s track record?',
        a: 'On the landing page and in the public Telegram channel Voltrax Trades, which announces every entry and exit as it happens along with daily, weekly and monthly recaps. Both publish percentages and trade counts only — never balances or account details.',
      },
      {
        q: 'Can I lose more than I put in?',
        a: 'On a futures account the exchange liquidates a position before its loss exceeds the margin, so the most you can lose is the funds in the futures wallet — which can be all of them. Read the Risk Disclosure before connecting; it explains leverage, liquidation and what automation does and does not protect you from.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Your account',
    entries: [
      {
        q: 'I forgot my password.',
        a: 'Use "Forgot your password?" on the sign-in screen. We email a six-digit code that is valid for 15 minutes; enter it with your new password. Resetting signs out every device.',
      },
      {
        q: 'How do referrals work?',
        a: 'Every account has a referral code. Someone who registers through your link is tied to you, and you earn a share of the fees their account generates, paid out to the wallet or bank details you add under Referrals.',
      },
      {
        q: 'How do I delete my account and data?',
        a: 'Disconnect your exchange accounts, then email support from the address on your account. We remove your profile and API credentials within 30 days; invoices and trade records are kept for as long as accounting law requires, as the Privacy Policy explains.',
      },
    ],
  },
]

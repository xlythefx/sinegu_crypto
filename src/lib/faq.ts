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
        a: 'Binance. MEXC and Bybit are coming soon — an account already connected on MEXC keeps trading as before.',
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
        a: 'Open the invoice under Billing & Invoices in the dashboard and pick one of two buttons. "Pay with crypto" is USDT on the TRON network (TRC-20): send the exact amount shown to our wallet, and the invoice is marked paid automatically once the transfer lands. "Pay with Stripe" takes you to Stripe\'s secure checkout to pay by card, and the invoice is marked paid as soon as Stripe confirms the payment. Either way, we email you when the payment is received.',
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
        a: 'The dashboard shows a notice that says what is wrong. Usually it is one of three things: the key is restricted to the wrong IP address (allow our server\'s IP, shown in the notice), the key is not allowed to trade futures (turn that permission on at the exchange), or the key no longer exists (disconnect the account and connect a new key). After fixing the IP or the permission, press "I\'ve fixed it — recheck": we check the key with the exchange again, including whether it is allowed to trade, and the notice clears once it passes. A key that is still refused 3 days after it was first flagged is disconnected automatically, so you can connect a fresh one.',
      },
      {
        q: 'Can I trade manually on the same account?',
        a: 'No. The Terms and Conditions (section 4.3) ask you not to. We record every trade on a connected account, not only the bot\'s, so a trade you make yourself counts in your profit and loss, your high-water mark and your monthly fee exactly like a bot trade, whether it wins or loses. The exchange also merges it with the bot\'s position in the same coin, so the bot\'s next exit closes both; and closing the bot\'s position yourself leaves your account out of step with later signals. To trade on your own, use a separate exchange account or sub-account that is not connected to Pixel Alpha. Deposits and withdrawals are fine: they are never counted as profit or loss. The one exception is closing your positions when you stop (see "How do I stop?").',
      },
      {
        q: 'How do I stop?',
        a: 'Disconnect the account from Exchange Accounts — trading on that key stops immediately. If a position is still open, either wait for the strategy\'s exit before you disconnect, or close it yourself on the exchange just before you do. Closing out when you stop is allowed, and that close counts like any other trade. You can also delete the key at the exchange, which cuts our access regardless.',
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

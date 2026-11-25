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
        a: 'A monthly fee, only for a month in which your account ends above its high-water mark (see below). The standard rates are 20% of the month\'s closed profit, after exchange fees, plus 6% of the profit on positions still open when the bill is made on the 1st. Nothing to connect and no subscription. A month with no fee still appears in your invoice list as a $0 invoice, with nothing to pay.',
      },
      {
        q: 'What is the high-water mark?',
        a: 'The value your account has to beat before any fee is due: the highest value it has reached at a previous month end, counting open positions at their profit or loss at that moment. Your first mark is the money in the account when it started with us. Deposits and withdrawals are never profit or loss: a deposit raises the mark by the same amount and a withdrawal lowers it. A month that ends at or below the mark costs nothing, so after a losing month you pay nothing until the account has made the loss back and gone higher. Once a month ends above the mark, the fee is worked out on that month\'s whole closed profit, not only the part above the mark. Example: the mark is $2,300, April ends at $2,250, and May closes +$250 to end at $2,500. May\'s fee is 20% of $250 = $50.',
      },
      {
        q: 'How are positions still open at month end billed?',
        a: 'If the month ends above the mark, 6% of the profit on your open positions when the bill is made on the 1st is added to that month\'s invoice. That 6% is not credited back later. When the position closes, its profit counts in the closed profit of the month it closes in, and is billed at 20% if that month also ends above the mark. If it closes at a loss instead, the 6% already billed is not refunded. Example: a position is $500 in profit on the 1st, so the invoice includes 6% of $500 = $30. Next month it closes at +$500, another trade closes at +$100, and the month ends above the mark: that month\'s fee is 20% of $600 = $120.',
      },
      {
        q: 'How do I pay?',
        a: 'Open the invoice under Billing & Invoices in the dashboard and pick one of two buttons. "Pay with crypto" is USDT on the TRON network (TRC-20): send the exact amount shown to our wallet, and the invoice is marked paid automatically once the transfer lands. "Pay with Stripe" takes you to Stripe\'s secure checkout to pay by card, and the invoice is marked paid as soon as Stripe confirms the payment. Either way, we email you when the payment is received.',
      },
      {
        q: 'What happens if I don\'t pay?',
        a: 'Invoices are made on the 1st and due on the 4th, and we email reminders on the 2nd and 3rd. If an invoice is still unpaid on the 4th, trading on your account is paused and we email you. While it is paused the bot opens no new trades on your account, but positions that are still open are closed as usual when the strategy exits them. As soon as you pay, trading turns back on by itself — no need to contact support. A paused account cannot make profit, so we suggest paying every invoice on time.',
      },
      {
        q: 'Does the exchange charge fees too?',
        a: 'Yes. The exchange takes its own trading commission and funding payments on every trade, regardless of outcome. Those go to the exchange, not to us. Our 20% is worked out on closed profit AFTER those fees, never before. The 6% on positions still open uses the open profit the exchange shows, before the fee for closing them. Your dashboard shows profit both before and after exchange fees.',
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

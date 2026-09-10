import { COMPANY } from './company'
import type { LegalDocumentContent } from '../types/legal'

/**
 * Pixel Alpha — the Trading Bot overview (footer → Product → Trading Bot).
 *
 * Same content-as-data shape as `terms.ts`, and the same three rules apply:
 *
 * 1. The product is **Pixel Alpha** everywhere a human reads it.
 * 2. The venues are **exchanges** (Binance / Bybit / MEXC), never "brokers",
 *    and those three are the whole universe — Binance is live, Bybit and MEXC
 *    are "coming soon" until their tables land.
 * 3. Every number quoted here must match what the engine actually enforces
 *    (`trading-flask/binance_abcd/`) — the 1,000 USDT deposit gate, 20% of
 *    profit above the high-water mark, no withdrawal permission. A marketing
 *    page that promises a different rule than the code enforces is a support
 *    ticket, not copy.
 */
export const TRADING_BOT: LegalDocumentContent = {
  title: 'The Pixel Alpha Trading Bot',
  updatedAt: 'September 4, 2026',
  lede: 'Pixel Alpha is an automated crypto trading bot that runs on your own exchange account. You connect your exchange with trade-only API keys, our system sends the signals, and every trade is executed in your account — your money never leaves it. There is no subscription and no upfront cost: you pay 20% of the profit you actually make, and nothing at all in a month you do not.',

  sections: [
    {
      id: 'what-it-is',
      number: '01',
      title: 'What Pixel Alpha is',
      blocks: [
        {
          kind: 'p',
          text: 'Pixel Alpha is a signal and execution service for crypto futures. We research and run a trading strategy; you keep your capital on the exchange you already use. When the strategy fires, our engine places the corresponding order in your account through the API key you connected — in seconds, around the clock, whether or not you are at your screen.',
        },
        {
          kind: 'p',
          text: 'We are deliberately not a broker, an exchange, a fund, or a custodian. We never hold, receive, pool or move customer funds. The only thing we hold is a trade-only API key, and the only thing that key can do is open and close positions in your account.',
        },
        {
          kind: 'list',
          items: [
            'You keep custody — funds stay in your own exchange account the entire time.',
            'You connect once — after that the bot runs unattended.',
            'You can revoke access at any moment, from your exchange or from your dashboard.',
            'You pay only on profit — 20% of what you earn, invoiced monthly.',
          ],
        },
      ],
    },
    {
      id: 'how-it-works',
      number: '02',
      title: 'How it works',
      blocks: [
        {
          kind: 'p',
          text: 'The whole product is four steps, and only the first one asks anything of you.',
        },
        { kind: 'h3', text: '2.1 You connect your exchange' },
        {
          kind: 'p',
          text: 'You create an API key on your exchange with trading enabled and withdrawals disabled, then paste the key pair into Pixel Alpha. Our step-by-step Binance guide walks through every screen, including the server address to allow-list if you restrict the key by IP.',
        },
        { kind: 'h3', text: '2.2 We generate the signals' },
        {
          kind: 'p',
          text: 'Our strategy watches the market continuously and produces entry and exit signals for a curated list of futures pairs. You do not have to interpret anything, subscribe to a channel, or copy a trade by hand — the signal is not a message to you, it is an instruction to the engine.',
        },
        { kind: 'h3', text: '2.3 Your account executes' },
        {
          kind: 'p',
          text: 'The moment a signal fires, the engine sizes the position for your account balance and places the order on your exchange. Every connected account is handled in parallel, so a customer with a small balance is filled at the same moment as a large one — nobody is queued behind anybody else.',
        },
        { kind: 'h3', text: '2.4 You watch, and get billed on profit' },
        {
          kind: 'p',
          text: 'Positions, closed trades, realized and unrealized P&L and your performance history appear in your dashboard as they happen. At the end of the billing period we issue one invoice for 20% of the profit above your previous high-water mark. Nothing to cancel, nothing charged in a flat month.',
        },
        {
          kind: 'note',
          text: 'Pixel Alpha only ever places and closes trades. It cannot withdraw, transfer, deposit or convert your funds — and if you ever enable withdrawal permission on a key, revoke it. No legitimate trading service, ours included, needs it.',
        },
      ],
    },
    {
      id: 'exchanges',
      number: '03',
      title: 'Supported exchanges',
      blocks: [
        {
          kind: 'p',
          text: 'Pixel Alpha supports three exchanges, and only these three. We would rather run one integration properly than five badly, so each exchange goes live only once its execution, balance and position syncing have been proven on real money.',
        },
        { kind: 'h3', text: '3.1 Binance — live' },
        {
          kind: 'p',
          text: 'Binance USD-M Futures is fully supported today: live orders, balance and position syncing, closed-trade history, funding and transfer tracking, and per-account invoicing. A Binance testnet mode is also available if you want to watch the bot operate on play money before committing real capital.',
        },
        { kind: 'h3', text: '3.2 Bybit — coming soon' },
        {
          kind: 'p',
          text: 'Bybit support is in development. The strategy, the sizing rules and the billing model are identical; only the exchange adapter differs. It will appear in your dashboard as connectable the day it goes live — you will not need a new account or a new plan.',
        },
        { kind: 'h3', text: '3.3 MEXC — coming soon' },
        {
          kind: 'p',
          text: 'MEXC support is likewise in development and will follow the same path. Until then the option is visible but locked, so you always know what is actually available rather than discovering it after you have created a key.',
        },
        {
          kind: 'p',
          text: 'We do not support, and have no plans to support, CFD brokers or equity platforms. Pixel Alpha is a crypto futures product on crypto exchanges.',
        },
      ],
    },
    {
      id: 'custody',
      number: '04',
      title: 'Your funds never leave your exchange',
      blocks: [
        {
          kind: 'p',
          text: 'This is the single most important property of the product, so it is worth stating plainly: at no point in the lifecycle of your account do we take possession of your money.',
        },
        {
          kind: 'list',
          items: [
            'You deposit to your own exchange account, in your own name, verified under your own KYC.',
            'We receive an API key, not funds. The key carries trading permission only.',
            'Profits and losses land in your account and stay there. There is no withdrawal to request from us.',
            'Disabling the key on your exchange, or disconnecting it in your dashboard, ends our access immediately.',
          ],
        },
        {
          kind: 'p',
          text: 'API keys are stored on our servers, used only to place and close trades, never displayed back to you after they are saved, and never shared with anyone. Editing an account in Pixel Alpha never reveals the secret — if you lose it, you create a new key on the exchange rather than recovering the old one.',
        },
        {
          kind: 'note',
          text: 'If your exchange restricts an API key to a specific IP address, it must include our server address, or the key will look connected while silently taking no trades. Our Binance guide shows exactly where to paste it, and your dashboard raises a warning if we detect a key blocked this way.',
        },
      ],
    },
    {
      id: 'strategy',
      number: '05',
      title: 'The strategy and the signals',
      blocks: [
        {
          kind: 'p',
          text: 'Pixel Alpha trades a systematic futures strategy on a curated set of liquid pairs. It is directional — it takes both long and short positions — and it is fully rule-based: every entry and exit comes from the same conditions being met, not from a discretionary opinion on the day.',
        },
        {
          kind: 'p',
          text: 'The strategy can add to a position in stages rather than committing everything to a single entry, and each stage is capped so a position cannot grow without limit. Exits are unconditional: when the strategy says close, the engine closes, and it will retry an exit that the exchange failed to confirm rather than leaving a position open.',
        },
        {
          kind: 'p',
          text: 'We publish the strategy behaviour, not its source. The specific conditions that trigger an entry are the part of the product we actually build, and disclosing them would let them be traded against.',
        },
        {
          kind: 'p',
          text: 'Every signal we send is announced publicly on our Telegram channel — entry, direction, ticker, increment, executed price, and the realized percentage on the close. You can compare what the channel published against what appeared in your own exchange account, trade for trade.',
        },
      ],
    },
    {
      id: 'sizing',
      number: '06',
      title: 'Position sizing and risk controls',
      blocks: [
        {
          kind: 'p',
          text: 'Every account gets the same signals, but not the same order size. Sizing is derived from your own balance, so a 1,000 USDT account and a 50,000 USDT account run the same strategy at proportional risk rather than at the same absolute exposure.',
        },
        { kind: 'h3', text: '6.1 Minimum funding' },
        {
          kind: 'p',
          text: 'An account must hold at least 1,000 USDT in deposited capital before the bot will open a position for it. Below that, order sizes fall under exchange minimums and a single trade becomes a disproportionate share of the account. The gate is measured on capital you deposited — not on your current balance — so a drawdown does not switch your bot off.',
        },
        { kind: 'h3', text: '6.2 Proportional sizing' },
        {
          kind: 'p',
          text: 'Order size scales in steps with your balance. Accounts below the reference balance all trade one base unit; above it, size increases in measured increments as the account grows. Sizing is recalculated from your live balance at the moment each signal fires, so compounding is automatic and a withdrawal is respected on the very next trade.',
        },
        { kind: 'h3', text: '6.3 Position caps' },
        {
          kind: 'p',
          text: 'Each traded asset carries a maximum position size. Once your open position in that asset reaches the cap, further entry signals are skipped for you until the position is closed or reduced — this is what keeps a long run of one-directional signals from turning into an oversized position. Exits are never capped or gated: an open position can always be closed.',
        },
        { kind: 'h3', text: '6.4 Exchange-level protection' },
        {
          kind: 'p',
          text: 'Leverage, margin mode and position mode are set per asset by us and applied on your account when a trade is placed. Assets that are not explicitly configured are never traded — an unrecognized signal is refused rather than guessed at.',
        },
        {
          kind: 'note',
          text: 'Risk controls limit position size. They do not limit loss. Futures trading is leveraged, and a leveraged position can lose money faster than an unleveraged one — including, in adverse conditions, more than you expected to risk on a single trade.',
        },
      ],
    },
    {
      id: 'getting-started',
      number: '07',
      title: 'Getting started',
      blocks: [
        {
          kind: 'p',
          text: 'From a standing start, connecting takes about ten minutes, most of which is the exchange’s own security prompts.',
        },
        {
          kind: 'list',
          items: [
            'Create a free Pixel Alpha account — no card, no payment details, nothing to cancel.',
            'Open your exchange’s API management page and create a key with Futures trading enabled and withdrawals disabled.',
            'If you restrict the key by IP, add our server address to the allow-list.',
            'Paste the API key and secret into Pixel Alpha and confirm the connection.',
            'Transfer USDT into your USD-M Futures wallet — at least the 1,000 USDT minimum.',
            'That is the end of your involvement. The next signal trades your account.',
          ],
        },
        {
          kind: 'p',
          text: 'Our Binance documentation covers each of these steps with screenshots of the actual Binance screens, including where the signature type and the IP restriction live. If you would rather watch first, connect a Binance testnet key instead and let the bot run on play money.',
        },
      ],
    },
    {
      id: 'pricing',
      number: '08',
      title: 'Pricing — 20% of profit, nothing else',
      blocks: [
        {
          kind: 'p',
          text: 'Pixel Alpha is free to use. There is no subscription, no setup fee, no minimum term, and no charge for connecting an account or for a month in which the strategy did not make you money.',
        },
        { kind: 'h3', text: '8.1 The performance fee' },
        {
          kind: 'p',
          text: 'We charge 20% of realized profit. If the bot earns you 5,000 USDT in a period, the invoice is 1,000 USDT and 4,000 stays in your account. If it earns nothing, there is no invoice.',
        },
        { kind: 'h3', text: '8.2 The high-water mark' },
        {
          kind: 'p',
          text: 'Fees are charged above a high-water mark, so a losing period must be recovered before anything is billable again. You are never charged twice for the same profit, and you are never charged for climbing back out of a drawdown.',
        },
        { kind: 'h3', text: '8.3 How you pay' },
        {
          kind: 'p',
          text: 'Invoices appear in your dashboard with a full breakdown of the trades behind them, and are payable in crypto (USDT). Every figure on an invoice can be traced back to closed positions you can verify on your own exchange.',
        },
        {
          kind: 'note',
          text: 'Because trading continues while an invoice is outstanding, an account with a past-due invoice is paused rather than left running up an unpaid balance. Settling the invoice re-enables it automatically.',
        },
      ],
    },
    {
      id: 'transparency',
      number: '09',
      title: 'Transparency and reporting',
      blocks: [
        {
          kind: 'p',
          text: 'An automated bot is only trustworthy if you can check it. Everything we do to your account is visible in three independent places.',
        },
        {
          kind: 'list',
          items: [
            'Your dashboard — open positions, closed trades, per-asset performance, daily and cumulative P&L, deposits and withdrawals, and every invoice with its underlying trade list.',
            'Our public Telegram channel — every signal published as it fires, so you can verify the trade you received against the trade we sent.',
            'Your exchange — the ultimate record. Every order the bot places appears in your own Binance trade history under your own account.',
          ],
        },
        {
          kind: 'p',
          text: 'Our published track record is generated from real, live accounts trading real money — testnet and sandbox accounts are excluded from it, returns are compounded rather than summed, and it is stated as a percentage rather than a dollar figure. It is a record, not a projection.',
        },
      ],
    },
    {
      id: 'requirements',
      number: '10',
      title: 'Requirements and limits',
      blocks: [
        {
          kind: 'list',
          items: [
            'An account on a supported exchange — Binance today, Bybit and MEXC soon — that is verified and permitted to trade futures in your jurisdiction.',
            'At least 1,000 USDT of deposited capital in the USD-M Futures wallet.',
            'An API key with Futures trading enabled and withdrawal permission disabled.',
            'If the key is IP-restricted, our server address on the allow-list.',
            'One connected exchange account per user at present.',
          ],
        },
        {
          kind: 'p',
          text: 'Some limits are outside our control. Exchanges impose their own rate limits, occasionally have outages, and may restrict futures trading in particular countries. During an exchange outage the bot cannot place or close orders on that exchange, and no software can trade an API that is not answering.',
        },
        {
          kind: 'p',
          text: 'You remain responsible for the tax, regulatory and reporting obligations arising from trading in your own account and jurisdiction. We provide records; we do not provide tax or legal advice.',
        },
      ],
    },
    {
      id: 'risk',
      number: '11',
      title: 'Risk disclosure',
      blocks: [
        {
          kind: 'note',
          text: 'Trading cryptocurrency futures carries a high level of risk and is not suitable for everyone. You can lose money, including your entire deposited capital. Never trade with funds you cannot afford to lose.',
        },
        {
          kind: 'p',
          text: 'Past performance is not a reliable indicator of future results. A strategy that performed well historically, including in our own published track record, can perform poorly or lose money in the future. Market conditions change, and no automated system is exempt from that.',
        },
        {
          kind: 'p',
          text: 'Pixel Alpha provides trading technology. We do not provide investment advice, portfolio management or a recommendation to buy or sell any asset, and nothing on this page constitutes any of those. The decision to connect an account and the capital you allocate to it are yours alone.',
        },
        {
          kind: 'p',
          text: 'Automated systems can also fail in ways manual trading does not — connectivity loss, exchange API errors, rejected orders, or a signal arriving during illiquid conditions. We build for these cases and retry what can safely be retried, but we cannot guarantee that every trade executes at the intended price, or at all.',
        },
      ],
    },
    {
      id: 'support',
      number: '12',
      title: 'Support and contact',
      blocks: [
        {
          kind: 'p',
          text: 'If a trade looks wrong, an invoice does not match your history, or your key stops working, contact us with your account name and the date in question — every trade we place is logged on our side and can be reconciled against your exchange history.',
        },
        { kind: 'email', label: 'Support', address: COMPANY.email },
        {
          kind: 'p',
          text: `${COMPANY.tradingName} is operated by ${COMPANY.legalName} (Reg. ${COMPANY.registryNumber}), ${COMPANY.addressLines.join(', ')}.`,
        },
      ],
    },
  ],

  acknowledgment:
    'By connecting an exchange account to Pixel Alpha you confirm that you understand the bot trades automatically in your own account, that you keep custody of and responsibility for your funds, that trading futures can result in the loss of your capital, and that you are charged 20% of the profit made above your high-water mark and nothing otherwise.',
}

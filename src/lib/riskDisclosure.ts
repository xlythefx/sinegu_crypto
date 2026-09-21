import { COMPANY } from './company'
import type { LegalDocumentContent } from '../types/legal'

/**
 * Pixel Alpha — Risk Disclosure.
 *
 * Lifted out of the Terms (§15 there is one paragraph) into a document of
 * its own, because a leveraged-futures product has to put the risks where a
 * customer actually reads them: linked from the register form, the connect
 * wizard and the footer, not buried as clause fifteen of nineteen.
 *
 * Every mechanism named here (stacking, the deposit gate, market orders,
 * exits that always run, blocked keys) is one the engine really has. Keep it
 * that way — a risk statement that describes a product we do not run is
 * worth less than none.
 */
export const RISK_DISCLOSURE: LegalDocumentContent = {
  title: 'Risk Disclosure',
  updatedAt: 'September 17, 2026',
  lede: 'Pixel Alpha places leveraged cryptocurrency futures trades on an exchange account that you own and fund. This document explains, in plain language, what can go wrong and what that would mean for your money. Please read all of it before connecting an exchange account.',

  sections: [
    {
      id: 'capital',
      number: '01',
      title: 'You Can Lose Your Capital',
      blocks: [
        {
          kind: 'note',
          text: 'Trading cryptocurrency futures with leverage can result in the loss of all of the funds in your futures wallet. Past performance — including the track record published on our site and in our Telegram channel — is not a guarantee or prediction of future results. Only trade with money you can afford to lose entirely.',
        },
        {
          kind: 'p',
          text: 'Cryptocurrency prices are extremely volatile. Moves of 10% or more in a single day are common, and leverage multiplies both gains and losses. A position opened with 25× leverage loses 25% of its margin on a 1% move against it.',
        },
      ],
    },
    {
      id: 'leverage',
      number: '02',
      title: 'Leverage and Liquidation',
      blocks: [
        {
          kind: 'p',
          text: 'Positions are opened with the leverage set on the trading signal, typically 25×. Leverage is set on the exchange, and it is the exchange — not Pixel Alpha — that decides when a position is liquidated. If the market moves far enough against an open position, the exchange closes it and the margin backing it is lost. Depending on your exchange settings (cross versus isolated margin), a liquidation can consume more of your wallet than the margin of the single position.',
        },
        {
          kind: 'p',
          text: 'Several signals can add to the same position ("stacking") up to a limit set per asset. A stacked position carries more margin at risk than a single entry, and the strategy may add to a position that is already losing.',
        },
      ],
    },
    {
      id: 'automation',
      number: '03',
      title: 'Automated Execution',
      blocks: [
        {
          kind: 'p',
          text: 'Trades are placed automatically, without your review, whenever a signal arrives — including while you are asleep or offline. By connecting an exchange account you authorise this. You should assume that any open position may be increased, reduced or closed at any time.',
        },
        {
          kind: 'list',
          items: [
            'Orders are market orders. They fill at whatever price the exchange has at that moment, which in a fast market can be materially worse than the signal price. This slippage is a cost you bear.',
            'Signals are received from a third-party charting service over the internet. A delayed, duplicated or missing signal is possible, and a signal that reaches the exchange late executes at a later price.',
            'Exchange outages, API errors, rate limits and maintenance windows can prevent an entry or — more seriously — an exit from executing. Our engine retries a failed exit, but it cannot close a position on an exchange that is not answering.',
            'A software error on our side could place, size or close a trade incorrectly. We test the engine and log every signal, but no software is free of defects.',
          ],
        },
      ],
    },
    {
      id: 'your-setup',
      number: '04',
      title: 'Things Under Your Control',
      blocks: [
        {
          kind: 'p',
          text: 'Some failures are caused by the configuration of your own exchange account. They are yours to prevent, and we may not be able to detect them in time:',
        },
        {
          kind: 'list',
          items: [
            'An API key restricted to an IP address other than ours silently stops working. Your account looks connected but receives no trades — and an open position may not receive its exit. We flag such keys when the exchange reports them, but only after the fact.',
            'Withdrawing margin, changing leverage or margin mode, trading manually on the same account, or closing a position yourself can leave the engine with a different picture of your account than the real one, and later signals may act on that picture.',
            'Insufficient balance means a signal is skipped for your account while it executes for others. Positions below the minimum size for the symbol are also skipped.',
            'A key created with withdrawal permission exposes your funds to a risk the platform never needs. Create trade-only keys, as our guide describes.',
          ],
        },
      ],
    },
    {
      id: 'no-advice',
      number: '05',
      title: 'No Advice, No Guarantee',
      blocks: [
        {
          kind: 'p',
          text: `${COMPANY.name} is a technology provider. We do not give investment advice, we do not manage your account on a discretionary basis, and we make no representation that the strategy is suitable for you or will be profitable. The decision to connect an account, how much to fund it with, and when to disconnect it are yours alone.`,
        },
        {
          kind: 'p',
          text: 'The strategy is applied uniformly to every connected account. It does not know your financial situation, your risk tolerance or your other investments.',
        },
      ],
    },
    {
      id: 'fees',
      number: '06',
      title: 'Fees Do Not Refund Losses',
      blocks: [
        {
          kind: 'p',
          text: 'Our success-based usage fee is charged on profit above your account\'s previous high-water mark, so we charge nothing in a losing month. However, a fee already paid on an earlier profitable month is not refunded if a later month loses money. Exchange trading fees and funding payments are charged by the exchange on every trade regardless of outcome and are separate from our fee.',
        },
        {
          kind: 'p',
          text: 'An unpaid invoice disables trading on your account. If a position is open when that happens, exits are still executed, but no new positions are opened until the invoice is settled.',
        },
      ],
    },
    {
      id: 'counterparty',
      number: '07',
      title: 'Exchange and Counterparty Risk',
      blocks: [
        {
          kind: 'p',
          text: 'Your funds are held by the exchange, not by us. An exchange can suspend withdrawals, become insolvent, be hacked, delist a market or change its rules. Losses caused by the exchange are outside our control and are not covered by us.',
        },
        {
          kind: 'p',
          text: 'Cryptocurrency derivatives are unregulated or restricted in many jurisdictions. It is your responsibility to confirm that trading them, and using an automated service to do so, is lawful where you live and permitted by your exchange\'s terms.',
        },
      ],
    },
    {
      id: 'acknowledgement',
      number: '08',
      title: 'Questions',
      blocks: [
        {
          kind: 'p',
          text: 'If anything in this document is unclear, ask us before you connect an account — we would rather answer a question than explain a loss.',
        },
        { kind: 'email', label: 'Email', address: COMPANY.email },
        { kind: 'telegram', label: 'Telegram', handle: COMPANY.telegram },
      ],
    },
  ],

  acknowledgment:
    'By connecting an exchange account to Pixel Alpha you confirm that you have read and understood this Risk Disclosure, that you can bear the loss of the funds you trade with, and that you accept the risks described above as your own.',
}

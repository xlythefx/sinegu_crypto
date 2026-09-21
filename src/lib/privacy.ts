import { COMPANY, OFFICE } from './company'
import type { LegalDocumentContent } from '../types/legal'

/**
 * Pixel Alpha — Privacy Policy.
 *
 * Same rules as `terms.ts`: the product is Pixel Alpha everywhere a human
 * reads it, the contact channels come from `lib/company.ts`, and the venues
 * are exchanges. One extra rule for THIS file: every claim about what we do
 * with data must describe what the code actually does. "Encrypted at rest",
 * "anonymised", "never shared" are promises a regulator can test against the
 * database — write what is true, and change the code before changing the
 * wording.
 */
export const PRIVACY: LegalDocumentContent = {
  title: 'Privacy Policy',
  updatedAt: 'September 17, 2026',
  lede: `This Privacy Policy explains what personal data ${COMPANY.name} collects when you use pixel-alpha.com and the Pixel Alpha platform, why we collect it, who we share it with, and the choices you have. Please read it together with our Terms and Conditions.`,

  sections: [
    {
      id: 'controller',
      number: '01',
      title: 'Who We Are',
      blocks: [
        {
          kind: 'p',
          text: `The data controller is ${COMPANY.name}, ${OFFICE.addressLines.join(', ')}, ${OFFICE.country}. Where this policy says "we", "us" or "our", it means ${COMPANY.name}.`,
        },
        {
          kind: 'p',
          text: 'Pixel Alpha is a technology platform that executes trading signals on exchange accounts you own. We are not an exchange, broker, custodian or investment adviser, and we never hold your funds.',
        },
      ],
    },
    {
      id: 'data-we-collect',
      number: '02',
      title: 'What We Collect',
      blocks: [
        { kind: 'h3', text: '2.1 Information you give us' },
        {
          kind: 'list',
          items: [
            'Account details: your name, email address and a password (stored only as a one-way hash — we cannot read it).',
            'Profile images you choose to upload.',
            'Exchange API credentials: the API key and secret you generate at Binance, Bybit or MEXC and paste into the platform, the display name you give the connection, and whether it is a live or a demo (testnet) account.',
            'Payout details you add for the referral programme: a cryptocurrency wallet address or bank wire details.',
            'The Terms version you accepted and when you accepted it.',
            'Anything you send us when you contact support by email or Telegram.',
          ],
        },
        { kind: 'h3', text: '2.2 Information we collect from your exchange' },
        {
          kind: 'p',
          text: 'Once you connect an exchange account, our trading engine reads it through the API on a schedule: account balance, open positions, closed trades (symbol, side, size, entry and exit prices, realised profit or loss, commissions and funding fees), and deposits and withdrawals into the futures wallet. This is the data the dashboard, the performance analytics and your invoices are built from.',
        },
        { kind: 'h3', text: '2.3 Information we generate' },
        {
          kind: 'list',
          items: [
            'A log of every trading signal processed for your account: what was sent to the exchange, at what size, and whether it filled, was skipped or failed — kept so that any trade on your account can be explained.',
            'Invoices for the success-based usage fee, the high-water mark they are computed from, and the payment records that settle them.',
            'Referral records: which referral code (if any) you registered with and the commissions that result.',
            'Login times ("last activity") and the API session tokens that keep you signed in.',
          ],
        },
        { kind: 'h3', text: '2.4 Technical information' },
        {
          kind: 'p',
          text: 'Our web servers and Cloudflare, which sits in front of them, record standard request logs: your IP address, browser type, the pages requested and timestamps. We use these for security (rate limiting, abuse detection) and for keeping the service running. We do not run advertising trackers or third-party analytics scripts on the platform.',
        },
      ],
    },
    {
      id: 'purposes',
      number: '03',
      title: 'Why We Use It',
      blocks: [
        {
          kind: 'p',
          text: 'We use your data only for the purposes below. Where the GDPR or a similar law applies to you, the legal basis for each is given in brackets.',
        },
        {
          kind: 'list',
          items: [
            'To provide the service you signed up for: placing and closing trades on your exchange account, showing you your positions and performance, and computing your fees (performance of a contract).',
            'To bill you and to collect the success-based usage fee, and to keep the accounting records the law requires us to keep (performance of a contract; legal obligation).',
            'To operate the referral programme and pay referrers (performance of a contract).',
            'To keep the platform secure: detecting blocked or misconfigured API keys, rate-limiting abusive traffic, and investigating incidents (legitimate interests).',
            'To answer your support requests (legitimate interests; performance of a contract).',
            'To send you service emails such as password reset codes, invoice notices and important changes to the service. These are not marketing emails and you cannot opt out of them while you hold an account (performance of a contract).',
            'To publish an aggregated, anonymous track record of the strategy — percentages and trade counts only, never balances, amounts, names or account identifiers (legitimate interests).',
          ],
        },
        {
          kind: 'note',
          text: 'We do not sell your personal data, and we do not use it for advertising or profiling.',
        },
      ],
    },
    {
      id: 'api-keys',
      number: '04',
      title: 'Your Exchange API Keys',
      blocks: [
        {
          kind: 'p',
          text: 'Your API credentials are the most sensitive thing you give us, so this section says exactly how they are handled.',
        },
        {
          kind: 'list',
          items: [
            'We ask you to create keys WITHOUT withdrawal permission. A key created as our guide describes can trade on your futures account and read its data; it cannot move funds off the exchange. Please never grant a key more than that.',
            'Keys are transmitted only over HTTPS and stored on our access-controlled servers. Only the trading engine uses them, and only to place orders and read your account as described above.',
            'In the admin tools our staff see a masked hint of the key (first and last characters) — the full key and the secret are never shown in any screen.',
            'You can disconnect a key at any time from Exchange Accounts. Disconnecting stops all trading on that key immediately. Because your trade history and invoices refer to the connection, the record of the connection is kept (see Retention), but the key is no longer used.',
            'You can also revoke the key at the exchange itself at any time, which cuts our access regardless of what our systems do.',
          ],
        },
      ],
    },
    {
      id: 'sharing',
      number: '05',
      title: 'Who We Share It With',
      blocks: [
        {
          kind: 'p',
          text: 'We share personal data only with the providers we need to run the service, and only what each of them needs:',
        },
        {
          kind: 'list',
          items: [
            'Your exchange (Binance, Bybit or MEXC): the orders our engine places on your behalf. The exchange already holds your identity; we send it trading instructions, not your personal details.',
            'Hosting and network providers: our servers are operated by Contabo GmbH (Germany) and fronted by Cloudflare, Inc., which processes request metadata such as IP addresses to protect the site.',
            'Payment processors: when you pay an invoice with a card or through our crypto checkout, the processor (currently Coinsbuy) receives the invoice amount and a reference; when you pay in USDT directly, the payment is a public blockchain transaction that anyone can see, and we record its transaction id against your invoice.',
            'Email delivery: the provider that delivers our service emails receives your email address and the message content.',
            'Referrers: if you registered through someone\'s referral link, that person can see that a referred account exists, the referral commission earned from your fees, and the display name on your account. They never see your email, your API keys or your trades.',
            'Authorities and advisers: where the law requires it, or to establish or defend a legal claim.',
          ],
        },
        {
          kind: 'p',
          text: 'Our public Telegram channel and the track record on our landing page publish only the strategy\'s aggregated performance — percentages, trade counts and traded symbols. Nothing there identifies a customer or an account.',
        },
      ],
    },
    {
      id: 'transfers',
      number: '06',
      title: 'International Transfers',
      blocks: [
        {
          kind: 'p',
          text: `${COMPANY.name} operates from ${OFFICE.country}. Our hosting provider is in the European Union, and Cloudflare and the exchanges operate globally. Where personal data leaves the EEA or the UK to a country without an adequacy decision, we rely on the providers' standard contractual clauses or an equivalent safeguard.`,
        },
      ],
    },
    {
      id: 'retention',
      number: '07',
      title: 'How Long We Keep It',
      blocks: [
        {
          kind: 'list',
          items: [
            'Account data: for as long as your account exists. When you ask us to close it, we delete your profile and API credentials within 30 days.',
            'Trade history, invoices and payment records: for 7 years after the transaction, because tax and accounting law requires us to keep the records behind every fee we charged.',
            'Signal and engine logs: up to 12 months, then deleted or reduced to anonymous statistics.',
            'Server and security logs: up to 90 days.',
            'Support conversations: up to 24 months after the last message.',
          ],
        },
        {
          kind: 'p',
          text: 'Where a record must be kept for legal reasons after you close your account, we keep only what that obligation requires and restrict its use to that purpose.',
        },
      ],
    },
    {
      id: 'security',
      number: '08',
      title: 'Security',
      blocks: [
        {
          kind: 'p',
          text: 'All traffic to the platform is encrypted with TLS. Passwords are hashed with a modern algorithm and are never stored or logged in clear. Access to production systems is limited to the people who operate them, and administrative screens mask credentials. Sign-in, registration and password reset are rate-limited to slow down automated attacks.',
        },
        {
          kind: 'p',
          text: 'No system is perfectly secure. If we become aware of a breach that affects your data, we will notify you and the relevant authority as the law requires. You can help by protecting your own login, using an API key without withdrawal rights, and restricting the key to our server IP where your exchange allows it.',
        },
      ],
    },
    {
      id: 'cookies',
      number: '09',
      title: 'Cookies and Local Storage',
      blocks: [
        {
          kind: 'p',
          text: 'The platform does not use advertising or analytics cookies. It stores two things in your browser\'s local storage: your theme preference (dark or light) and, once you sign in, the session token that keeps you signed in. Both are strictly necessary for the service to work and are removed when you sign out or clear your browser data. Cloudflare may set a technical cookie used purely to protect the site from bots.',
        },
        {
          kind: 'p',
          text: 'Fonts on the site are loaded from Google Fonts, which means Google receives your IP address when the page loads.',
        },
      ],
    },
    {
      id: 'rights',
      number: '10',
      title: 'Your Rights',
      blocks: [
        {
          kind: 'p',
          text: 'Depending on where you live, you may have the right to:',
        },
        {
          kind: 'list',
          items: [
            'Access the personal data we hold about you and receive a copy.',
            'Correct data that is inaccurate — your name and email can be changed in Settings.',
            'Delete your data, subject to the records we must keep by law.',
            'Restrict or object to processing that is based on our legitimate interests.',
            'Receive the data you gave us in a portable format.',
            'Complain to a supervisory authority — in the EU, the data protection authority of the country you live in; in the UK, the Information Commissioner\'s Office.',
          ],
        },
        {
          kind: 'p',
          text: 'To exercise any of these, write to us at the address in the Contact section from the email on your account. We answer within 30 days. We may ask you to confirm your identity first.',
        },
      ],
    },
    {
      id: 'children',
      number: '11',
      title: 'Age Limit',
      blocks: [
        {
          kind: 'p',
          text: 'Pixel Alpha is for adults who may lawfully trade leveraged cryptocurrency derivatives. You must be at least 18 years old (or the age of majority where you live) to hold an account. We do not knowingly collect data from anyone younger, and we delete such accounts when we learn of them.',
        },
      ],
    },
    {
      id: 'changes',
      number: '12',
      title: 'Changes to This Policy',
      blocks: [
        {
          kind: 'p',
          text: 'We may update this policy as the service changes. The "Last updated" date at the top shows the current version. For a material change — a new category of data, a new purpose, or a new kind of recipient — we will tell you by email or by a notice in the platform before it takes effect.',
        },
      ],
    },
    {
      id: 'contact',
      number: '13',
      title: 'Contact',
      blocks: [
        {
          kind: 'p',
          text: 'Questions about this policy or about your data go to:',
        },
        { kind: 'email', label: 'Email', address: COMPANY.email },
        { kind: 'telegram', label: 'Telegram', handle: COMPANY.telegram },
        {
          kind: 'p',
          text: `Postal address: ${COMPANY.name}, ${OFFICE.addressLines.join(', ')}, ${OFFICE.country}.`,
        },
      ],
    },
  ],

  acknowledgment:
    'By creating an account or using Pixel Alpha, you confirm that you have read this Privacy Policy and understand how your data is used. If you do not agree with it, please do not use the service.',
}

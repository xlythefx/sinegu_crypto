import { COMPANY } from './company'
import type { LegalDocumentContent } from '../types/legal'

/**
 * Pixel Alpha — Terms and Conditions.
 *
 * Two rules for editing this file:
 *
 * 1. The product is **Pixel Alpha** everywhere a human reads it. The contact
 *    address comes from `lib/company.ts` so the legal entity is named in one
 *    place only (see the invoice document, which reads the same constant).
 * 2. The trading venues are **exchanges** (Binance / Bybit / MEXC), never
 *    "brokers" — the wording has to describe the product a customer actually
 *    connected.
 */
export const TERMS: LegalDocumentContent = {
  title: 'Terms and Conditions',
  updatedAt: 'September 1, 2026',
  lede: 'Please read these Terms and Conditions carefully before using Pixel Alpha. By accessing or using our platform, you agree to be bound by these terms. If you do not agree to these terms, please do not use our services.',

  sections: [
    {
      id: 'acceptance',
      number: '01',
      title: 'Acceptance of Terms',
      blocks: [
        {
          kind: 'p',
          text: 'By accessing and using Pixel Alpha ("the Platform", "we", "us", or "our"), you accept and agree to be bound by these Terms and Conditions ("Terms"). These Terms apply to all users of the Platform, including visitors, registered users, and subscribers. If you do not agree to these Terms, you must not use our services.',
        },
        {
          kind: 'p',
          text: 'You consent to receive all communications, notices, and disclosures electronically via email or within the Platform.',
        },
      ],
    },
    {
      id: 'service',
      number: '02',
      title: 'Description of Service',
      blocks: [
        { kind: 'p', text: 'Pixel Alpha is a technology platform that provides:' },
        {
          kind: 'list',
          items: [
            'Tools for connecting and managing exchange accounts via API',
            'Trading analytics, performance tracking, and reporting',
            'Real-time alerts and notifications',
            'Position tracking',
            'Other related services as may be offered from time to time',
          ],
        },
        {
          kind: 'p',
          text: 'We reserve the right to modify, suspend, or discontinue any aspect of the Platform at any time without prior notice.',
        },
      ],
    },
    {
      id: 'accounts',
      number: '03',
      title: 'User Accounts and Registration',
      blocks: [
        { kind: 'h3', text: '3.1 Account Creation' },
        {
          kind: 'p',
          text: 'To use certain features of the Platform, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.',
        },
        { kind: 'h3', text: '3.2 Account Security' },
        {
          kind: 'p',
          text: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.',
        },
        { kind: 'h3', text: '3.3 Account Eligibility' },
        {
          kind: 'p',
          text: 'You must be at least 18 years old to use our services. By using the Platform, you represent and warrant that you are of legal age to form a binding contract and meet all eligibility requirements.',
        },
      ],
    },
    {
      id: 'use',
      number: '04',
      title: 'Use of the Platform',
      blocks: [
        { kind: 'h3', text: '4.1 Permitted Use' },
        {
          kind: 'p',
          text: 'You may use the Platform solely for lawful purposes and in accordance with these Terms. You agree not to:',
        },
        {
          kind: 'list',
          items: [
            'Violate any applicable laws or regulations',
            'Infringe upon the rights of others',
            'Transmit any malicious code, viruses, or harmful data',
            'Attempt to gain unauthorized access to the Platform or related systems',
            "Interfere with or disrupt the Platform's operation",
            'Use external automation systems to access the Platform without permission',
            'Reverse engineer, decompile, or disassemble any part of the Platform',
          ],
        },
        { kind: 'h3', text: '4.2 Exchange Integration' },
        {
          kind: 'p',
          text: "When you connect your exchange account, you are responsible for ensuring that you have the legal right to access and use the exchange's API. You agree to comply with your exchange's terms of service. We are not responsible for any issues arising from your relationship with the exchange.",
        },
      ],
    },
    {
      id: 'fees',
      number: '05',
      title: 'Fees and Payment',
      blocks: [
        {
          kind: 'p',
          text: 'Access to certain features of the Pixel Alpha Platform is provided under a software license model. Some plans may include a success-based usage fee.',
        },
        {
          kind: 'list',
          items: [
            '20% of realized net positive earnings, meaning profits from completed positions during the applicable billing period; and',
            '6% of unrealized net positive earnings, meaning gains from open positions that remain active and unclosed.',
          ],
        },
        {
          kind: 'p',
          text: 'All applicable fees are disclosed in advance. Payment of the applicable fee enables continued access to the licensed features. In the absence of payment, access to the Platform or specific features may be suspended.',
        },
        {
          kind: 'p',
          text: 'Pixel Alpha does not manage client funds, provide investment advice, or guarantee results. Users retain full control over their exchange accounts and trading decisions at all times.',
        },
        {
          kind: 'p',
          text: 'The success-based usage fee is calculated based on platform usage metrics derived from account data made available by the connected exchange. The fee applies only if the user realizes a net positive outcome during the usage period.',
        },
        {
          kind: 'p',
          text: 'The calculation mechanism is designed to avoid duplicate charges and applies only to incremental positive outcomes compared to the previous reference period. If no new positive outcome is achieved, no fee is applied.',
        },
        {
          kind: 'p',
          text: 'This fee is not a performance fee, profit share, or investment management charge, and does not constitute asset management, advisory services, or discretionary control over client accounts.',
        },
        { kind: 'h3', text: 'Exchange Fees and Third-Party Costs' },
        {
          kind: 'p',
          text: 'Trading through the Platform involves the use of third-party exchanges selected by the user. These exchanges may charge fees, commissions, spreads, financing charges, funding rates, inactivity fees, currency conversion fees, withdrawal fees, or other costs related to trading activity.',
        },
        {
          kind: 'p',
          text: 'Such fees and charges are not set, controlled, collected, or received by Pixel Alpha and are governed solely by the terms and conditions of the exchange chosen by the user.',
        },
        {
          kind: 'p',
          text: "Users are solely responsible for reviewing, understanding, and accepting their exchange's fee structure and for conducting their own due diligence before connecting an exchange account to the Platform.",
        },
        {
          kind: 'p',
          text: 'Pixel Alpha bears no responsibility or liability for any exchange-related fees, charges, pricing, execution conditions, or costs incurred as a result of trading through a third-party exchange.',
        },
        {
          kind: 'p',
          text: 'Users are solely responsible for determining and fulfilling any tax obligations arising from their trading activity, affiliate rewards, or use of the Platform. Pixel Alpha does not provide tax advice or reporting services.',
        },
      ],
    },
    {
      id: 'ip',
      number: '06',
      title: 'Intellectual Property',
      blocks: [
        {
          kind: 'p',
          text: 'The Platform and its original content, features, and functionality are owned by Pixel Alpha and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.',
        },
        {
          kind: 'p',
          text: 'You are granted a limited, non-exclusive, non-transferable license to access and use the Platform for your personal or internal business purposes. This license does not include the right to resell or commercially exploit the Platform or its content.',
        },
      ],
    },
    {
      id: 'user-content',
      number: '07',
      title: 'User Content and Data',
      blocks: [
        {
          kind: 'p',
          text: 'You retain ownership of any data, content, or information you provide to the Platform ("User Content"). By providing User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, store, and process your User Content solely for the purpose of providing and improving our services.',
        },
        {
          kind: 'p',
          text: 'You are solely responsible for your User Content and warrant that you have all necessary rights to provide it. We reserve the right to remove any User Content that violates these Terms or is otherwise objectionable.',
        },
      ],
    },
    {
      id: 'no-advice',
      number: '08',
      title: 'No Investment Advice',
      blocks: [
        {
          kind: 'p',
          text: 'Pixel Alpha does not provide investment advice, financial advice, or trading recommendations. The Platform is a technology tool only. All trading decisions are your own responsibility.',
        },
        {
          kind: 'p',
          text: 'Any information, analysis, alerts, or signals provided through the Platform are for informational purposes only and should not be construed as investment advice. You should consult with a qualified financial advisor before making investment decisions.',
        },
        {
          kind: 'p',
          text: "The Platform does not assess the suitability of any strategy, configuration, or automated execution for any individual user's financial situation, objectives, or risk tolerance.",
        },
      ],
    },
    {
      id: 'disclaimers',
      number: '09',
      title: 'Disclaimers and Limitations of Liability',
      blocks: [
        { kind: 'h3', text: '9.1 Service Availability' },
        {
          kind: 'p',
          text: 'The Platform is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that the Platform will be uninterrupted, error-free, or free from viruses or other harmful components.',
        },
        { kind: 'h3', text: '9.2 Limitation of Liability' },
        {
          kind: 'p',
          text: 'To the maximum extent permitted by law, Pixel Alpha, its affiliates, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or trading losses, arising from your use of the Platform.',
        },
        { kind: 'h3', text: '9.3 Data Accuracy' },
        {
          kind: 'p',
          text: 'While we strive for accuracy, we do not warrant that any data, information, or analytics provided through the Platform are accurate, complete, or current. You should verify all information independently. Market data, account data, and execution feedback are received from third-party exchanges and data providers. Pixel Alpha does not control these sources and is not responsible for inaccuracies, delays, outages, or discrepancies in such data.',
        },
        { kind: 'h3', text: '9.4 No Fiduciary Relationship' },
        {
          kind: 'p',
          text: 'Nothing in these Terms or in the use of the Platform creates any fiduciary duty, advisory relationship, partnership, joint venture, or trust relationship between the user and Pixel Alpha. The relationship is strictly that of a software service provider and user.',
        },
      ],
    },
    {
      id: 'indemnification',
      number: '10',
      title: 'Indemnification',
      blocks: [
        {
          kind: 'p',
          text: "You agree to indemnify, defend, and hold harmless Pixel Alpha, its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, costs, or expenses (including reasonable attorneys' fees) arising out of or relating to your use of the Platform, violation of these Terms, or infringement of any rights of another party.",
        },
      ],
    },
    {
      id: 'termination',
      number: '11',
      title: 'Termination',
      blocks: [
        {
          kind: 'p',
          text: 'We may terminate or suspend your account and access to the Platform immediately, without prior notice, for any reason, including if you breach these Terms. Upon termination:',
        },
        {
          kind: 'list',
          items: [
            'Your right to use the Platform will immediately cease',
            'We may delete your account and data (subject to our Privacy Policy)',
            'All provisions of these Terms that by their nature should survive termination shall survive',
          ],
        },
        {
          kind: 'p',
          text: 'You may terminate your account at any time by contacting us or using the account deletion feature in your settings.',
        },
      ],
    },
    {
      id: 'governing-law',
      number: '12',
      title: 'Governing Law and Dispute Resolution',
      blocks: [
        {
          kind: 'p',
          text: 'These Terms shall be governed by and construed in accordance with the laws of the State of Wyoming, United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or your use of the Platform shall be resolved through binding arbitration or in the courts of the State of Wyoming, United States, as applicable.',
        },
      ],
    },
    {
      id: 'changes',
      number: '13',
      title: 'Changes to Terms',
      blocks: [
        {
          kind: 'p',
          text: 'We reserve the right to modify these Terms at any time. We will notify you of any material changes by posting the updated Terms on the Platform and updating the "Last updated" date. Your continued use of the Platform after such changes constitutes acceptance of the modified Terms.',
        },
      ],
    },
    {
      id: 'severability',
      number: '14',
      title: 'Severability',
      blocks: [
        {
          kind: 'p',
          text: 'If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.',
        },
      ],
    },
    {
      id: 'risk',
      number: '15',
      title: 'Risk Disclosure',
      blocks: [
        {
          kind: 'note',
          text: 'Trading financial instruments involves substantial risk and may result in partial or total loss of capital. Past performance is not indicative of future results. You acknowledge that you may lose all or more than your initial investment and that you trade at your own risk.',
        },
      ],
    },
    {
      id: 'automated-execution',
      number: '16',
      title: 'Automated Execution Disclaimer',
      blocks: [
        {
          kind: 'p',
          text: 'The Platform relies on third-party services including exchanges, APIs, data providers, and execution infrastructure. We do not guarantee execution accuracy, timing, or price. Technical failures, latency, or third-party errors may result in missed, delayed, or unintended trades.',
        },
        {
          kind: 'p',
          text: 'By connecting an exchange account, you expressly authorize the Platform to transmit orders, instructions, and requests to the exchange via API according to your configuration. You acknowledge that such authorization remains under your control and responsibility at all times.',
        },
      ],
    },
    {
      id: 'affiliate',
      number: '17',
      title: 'Affiliate Program',
      blocks: [
        {
          kind: 'p',
          text: 'Participation in any affiliate or reward program does not guarantee income. Affiliate relationships are independent and do not constitute employment, partnership, or agency. We reserve the right to modify, suspend, or terminate affiliate participation at our discretion.',
        },
      ],
    },
    {
      id: 'role',
      number: '18',
      title: 'Role Clarification',
      blocks: [
        {
          kind: 'p',
          text: 'Pixel Alpha operates solely as a technology and analytics platform and is not a broker-dealer, investment advisor, asset manager, or custodian.',
        },
        {
          kind: 'p',
          text: 'The Platform provides automated trade execution only through user-authorized API connections to third-party exchanges. Pixel Alpha does not provide personalized investment advice, does not exercise discretionary control over user accounts, and does not hold, safeguard, or control client funds or assets. All trading activity is executed within accounts held at third-party exchanges selected by the user, and users retain full ownership, responsibility, and risk for all trading outcomes.',
        },
      ],
    },
    {
      id: 'contact',
      number: '19',
      title: 'Contact Information',
      blocks: [
        {
          kind: 'p',
          text: 'If you have any questions about these Terms and Conditions, please contact us:',
        },
        { kind: 'email', label: 'Email', address: COMPANY.email },
        { kind: 'telegram', label: 'Telegram', handle: COMPANY.telegram },
      ],
    },
  ],

  acknowledgment:
    'By using Pixel Alpha, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions, our Privacy Policy, and our Risk Disclaimer. If you do not agree, please do not use our services.',
}

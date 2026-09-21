import { Link } from 'react-router-dom'
import SocialLinks from '../ui/SocialLinks'
import { COMPANY } from '../../lib/company'

// `to` marks the entries that are real pages; anything without one would stay
// a plain (non-navigating) label rather than a dead link.
const COLUMNS: { title: string; links: { label: string; to?: string }[] }[] = [
  {
    title: 'PRODUCT',
    links: [
      { label: 'Trading Bot', to: '/trading-bot' },
      { label: 'FAQ', to: '/faq' },
    ],
  },
  {
    title: 'RESOURCES',
    links: [
      { label: 'Binance Docs', to: '/docs/binance' },
      { label: 'Contact & Support', to: '/contact' },
    ],
  },
  {
    title: 'LEGAL',
    links: [
      { label: 'Terms & Conditions', to: '/terms' },
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Risk Disclosure', to: '/risk' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-hair">
      <div className="max-w-[1280px] mx-auto py-11 px-10 grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-8 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <div>
          <div className="flex items-center gap-2.5 mb-3.5">
            <img
              className="w-5 h-5 object-contain scale-[1.6]"
              src="/assets/logo.png"
              alt=""
            />
            <span className="font-display font-extrabold text-[17px]">
              Pixel Alpha
            </span>
          </div>
          <p className="text-[13px] text-faint leading-[1.6] max-w-[280px]">
            Automated trading bots that run on your own exchange. Free to use —
            you only pay 20% of the profit you make.
          </p>
          {/* Public channels — where to follow, not where to get support. */}
          <SocialLinks className="mt-5" />
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="font-mono text-[11px] text-faint mb-3.5">
              {col.title}
            </div>
            <div className="flex flex-col gap-2.5 text-[13.5px] text-muted">
              {col.links.map((link) =>
                link.to ? (
                  <Link
                    className="cursor-pointer w-fit hover:text-text transition-colors"
                    key={link.label}
                    to={link.to}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <span className="cursor-pointer" key={link.label}>
                    {link.label}
                  </span>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="max-w-[1280px] mx-auto py-[18px] px-10 border-t border-hair flex justify-between items-center font-mono text-[11px] leading-[1.6] text-faint flex-wrap gap-x-8 gap-y-2">
        <span>
          © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
        </span>
        <span className="max-w-[52ch]">
          Trading cryptocurrency futures carries a high level of risk and may
          result in the loss of your capital. Past performance is not indicative
          of future results.
        </span>
      </div>
    </footer>
  )
}

import { Link } from 'react-router-dom'
import SocialLinks from '../ui/SocialLinks'
import { COMPANY } from '../../lib/company'
import { openConsentBanner } from '../../lib/consent'

// Every line here is at least the muted grey, never `text-faint` (owner,
// 2026-11-27: "these text not visible" — faint measured ~3.3:1 on the dark
// page, muted ~6.6:1). The risk sentence above all must be readable.
//
// `to` marks the entries that are real pages and `action` the ones that open
// something in place; anything with neither stays a plain label rather than
// a dead link.
const COLUMNS: {
  title: string
  links: { label: string; to?: string; action?: () => void }[]
}[] = [
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
      // Reopens the consent banner — changing your mind must be as easy as choosing.
      { label: 'Privacy choices', action: openConsentBanner },
    ],
  },
]

interface FooterProps {
  /** The line under the logo. The default is the live home page's wording. */
  blurb?: string
  /** Max-width utility, so a page on a narrower grid can line the footer up with it. */
  maxWidth?: string
}

const DEFAULT_BLURB =
  'Automated trading bots that run on your own exchange. Free to use — you only pay 20% of the profit you make.'

export default function Footer({ blurb = DEFAULT_BLURB, maxWidth = 'max-w-[1280px]' }: FooterProps = {}) {
  return (
    <footer className="border-t border-hair">
      <div className={`${maxWidth} mx-auto py-11 px-10 max-[560px]:px-5 grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-8 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1`}>
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
          <p className="text-[13px] text-muted leading-[1.6] max-w-[280px]">{blurb}</p>
          {/* Public channels — where to follow, not where to get support. */}
          <SocialLinks className="mt-5" />
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="font-mono text-[11px] text-muted mb-3.5">
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
                ) : link.action ? (
                  <button
                    type="button"
                    className="w-fit cursor-pointer border-0 bg-transparent p-0 text-left text-inherit hover:text-text transition-colors"
                    key={link.label}
                    onClick={link.action}
                  >
                    {link.label}
                  </button>
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
      <div className={`${maxWidth} mx-auto py-[18px] px-10 max-[560px]:px-5 border-t border-hair flex justify-between items-center font-mono text-[11px] leading-[1.6] text-muted flex-wrap gap-x-8 gap-y-2`}>
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

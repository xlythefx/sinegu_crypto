import { SOCIAL_LINKS } from '../../lib/company'
import { BRAND_ICONS } from './BrandIcons'

interface SocialLinksProps {
  /** Icon size in px. */
  size?: number
  className?: string
  /** Class for each link — the caller decides colors so the row matches its footer. */
  linkClassName?: string
}

/**
 * The "follow us" row: one icon link per entry in `SOCIAL_LINKS`, opening in
 * a new tab. Reads the URLs from `lib/company.ts` — never retyped per footer.
 * The marks themselves live in `BrandIcons.tsx` (the Discord one is reused
 * by the sign-in button).
 */
export default function SocialLinks({
  size = 18,
  className = '',
  linkClassName = 'text-muted hover:text-text',
}: SocialLinksProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {SOCIAL_LINKS.map(({ id, label, href }) => {
        const Icon = BRAND_ICONS[id]
        return (
          <a
            key={id}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label} (opens in a new tab)`}
            title={label}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-hair transition-colors hover:border-border ${linkClassName}`}
          >
            <Icon size={size} />
          </a>
        )
      })}
    </div>
  )
}

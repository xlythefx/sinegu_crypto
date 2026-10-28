import { BINANCE_OFFER_PATH } from './binanceOffer'

/**
 * The public pages the visitor counter counts, with the name Admin → Visitors
 * shows for each. Pure.
 *
 * API twin: `App\Services\Visits\VisitPages::PATHS`, which refuses anything
 * else. A new public page goes in BOTH lists, or its views are thrown away as
 * "unknown page". The dashboard and the admin portal are never counted.
 */
export const VISIT_PAGES: Record<string, string> = {
  '/': 'Home page',
  '/v2': 'Home page (v2)',
  '/auth': 'Sign in / Register',
  '/trading-bot': 'Trading bot',
  '/faq': 'FAQ',
  '/docs/binance': 'Binance guide',
  [BINANCE_OFFER_PATH]: 'Binance offer',
  '/contact': 'Contact',
  '/terms': 'Terms',
  '/privacy': 'Privacy Policy',
  '/risk': 'Risk disclosure',
}

/** The counted path for a router pathname ("/faq/" → "/faq"), or null when it is not counted. */
export function countedPath(pathname: string): string | null {
  const path = `/${pathname.toLowerCase().replace(/^\/+|\/+$/g, '')}`
  return path in VISIT_PAGES ? path : null
}

export function visitPageLabel(path: string): string {
  return VISIT_PAGES[path] ?? path
}

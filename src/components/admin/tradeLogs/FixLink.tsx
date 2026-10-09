import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { FIX_BTN } from './tradeLogClasses'

/**
 * Where to fix a problem ("Fix in API Keys"). The API sends the target; an
 * internal path routes in-app, anything else opens in a new tab.
 */
export default function FixLink({ fix }: { fix: { label: string; href: string } }) {
  const body = (
    <>
      {fix.label}
      <ArrowRight size={13} aria-hidden="true" />
    </>
  )
  if (fix.href.startsWith('/')) {
    return (
      <Link to={fix.href} className={FIX_BTN}>
        {body}
      </Link>
    )
  }
  return (
    <a href={fix.href} target="_blank" rel="noreferrer" className={FIX_BTN}>
      {body}
    </a>
  )
}
